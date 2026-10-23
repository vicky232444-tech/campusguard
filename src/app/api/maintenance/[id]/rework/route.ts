import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/**
 * POST /api/maintenance/[id]/rework — administrator re-opens a REJECTED report
 * (AI caught a morphed proof) and assigns it back to the maintenance team.
 * Body: { assignedToId?: string, note?: string }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.giveFinalVerdict(user.role)) return forbidden()

  const { id } = await ctx.params
  const { assignedToId, note } = (await req.json()) as { assignedToId?: string; note?: string }

  const report = await db.maintenanceReport.findUnique({ where: { id } })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })
  if (report.status !== 'REJECTED') {
    return Response.json({ error: 'Only AI-rejected reports can be re-assigned for rework' }, { status: 400 })
  }

  let assignee = { name: report.assignedTo, id: report.assignedToId }
  if (assignedToId) {
    const m = await db.user.findUnique({ where: { id: assignedToId } })
    if (!m || m.role !== 'MAINTENANCE') {
      return Response.json({ error: 'Selected assignee is not a maintenance team member' }, { status: 400 })
    }
    assignee = { name: m.name, id: m.id }
  }

  const updated = await db.maintenanceReport.update({
    where: { id },
    data: {
      status: 'IN_PROGRESS',
      assignedTo: assignee.name,
      assignedToId: assignee.id,
      proofMedia: null,
      proofNote: null,
      proofUploadedAt: null,
      aiAuthenticity: null,
      aiTamperScore: null,
      aiAuthenticityNote: null,
      reworkCount: { increment: 1 },
    },
  })

  await db.reportUpdate.create({
    data: {
      reportId: id,
      status: 'IN_PROGRESS',
      note: note?.trim() || `Administrator re-assigned the repair to ${assignee.name} after AI rejection — a genuine proof photo is now required.`,
      by: user.name,
    },
  })

  const withUpdates = await db.maintenanceReport.findUnique({
    where: { id },
    include: { updates: { orderBy: { createdAt: 'asc' } }, fines: { orderBy: { createdAt: 'desc' } } },
  })

  await broadcast({ kind: 'maintenance:update', payload: { report: updated } })
  return Response.json({ report: withUpdates })
}
