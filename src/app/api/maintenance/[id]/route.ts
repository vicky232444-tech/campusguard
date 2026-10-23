import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** GET /api/maintenance/[id] — report detail with full tracking timeline. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const { id } = await ctx.params
  const report = await db.maintenanceReport.findUnique({
    where: { id },
    include: { updates: { orderBy: { createdAt: 'asc' } }, fines: { orderBy: { createdAt: 'desc' } } },
  })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })
  return Response.json({ report })
}

/**
 * POST /api/maintenance/[id] — maintenance team starts the repair
 * (APPROVED → IN_PROGRESS) and can add assignment / progress notes.
 * All other transitions run through the dedicated workflow routes:
 * /approve (step 1) · /proof (step 2) · /confirm (step 3) · /verdict (final).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.updateReport(user.role)) return forbidden()

  const { id } = await ctx.params
  const { status, note, assignedTo } = (await req.json()) as {
    status?: 'IN_PROGRESS'
    note?: string
    assignedTo?: string
  }

  const report = await db.maintenanceReport.findUnique({ where: { id } })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })

  const data: Record<string, unknown> = {
    assignedTo: assignedTo !== undefined ? assignedTo || null : report.assignedTo,
  }
  if (status) {
    if (status !== 'IN_PROGRESS') {
      return Response.json({ error: 'Use /proof and /verdict routes for completion & closure' }, { status: 400 })
    }
    if (!['APPROVED', 'IN_PROGRESS'].includes(report.status)) {
      return Response.json({ error: 'Repair can only start after the administrator verifies the report' }, { status: 400 })
    }
    data.status = 'IN_PROGRESS'
    if (report.status === 'APPROVED') data.status = 'IN_PROGRESS'
  }

  const updated = await db.maintenanceReport.update({ where: { id }, data })

  if (status || note?.trim()) {
    await db.reportUpdate.create({
      data: { reportId: id, status: updated.status, note: note?.trim() || 'Repair started', by: user.name },
    })
  }

  const withUpdates = await db.maintenanceReport.findUnique({
    where: { id },
    include: { updates: { orderBy: { createdAt: 'asc' } }, fines: { orderBy: { createdAt: 'desc' } } },
  })

  await broadcast({ kind: 'maintenance:update', payload: { report: updated } })
  return Response.json({ report: withUpdates })
}
