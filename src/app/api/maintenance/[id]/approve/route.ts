import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/**
 * STEP 1 — Administrator verifies the reported problem and forwards it to the
 * maintenance team (with an assignee). POST /api/maintenance/[id]/approve
 * Body: { assignedToId: string, note?: string }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.approveReport(user.role)) return forbidden()

  const { id } = await ctx.params
  const { assignedToId, note } = (await req.json()) as { assignedToId?: string; note?: string }

  if (!assignedToId) {
    return Response.json({ error: 'Choose a maintenance team member to forward this report to' }, { status: 400 })
  }

  const report = await db.maintenanceReport.findUnique({ where: { id } })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })
  if (report.status !== 'PENDING') {
    return Response.json({ error: 'Only pending reports can be verified & forwarded' }, { status: 400 })
  }

  const assignee = await db.user.findUnique({ where: { id: assignedToId } })
  if (!assignee || assignee.role !== 'MAINTENANCE') {
    return Response.json({ error: 'Selected assignee is not a maintenance team member' }, { status: 400 })
  }

  const updated = await db.maintenanceReport.update({
    where: { id },
    data: {
      status: 'APPROVED',
      assignedTo: assignee.name,
      assignedToId: assignee.id,
      adminApprovedBy: user.name,
      adminApprovedAt: new Date(),
    },
  })

  await db.reportUpdate.create({
    data: {
      reportId: id,
      status: 'APPROVED',
      note: note?.trim() || `Verified by administrator and forwarded to ${assignee.name}`,
      by: user.name,
    },
  })

  const withUpdates = await db.maintenanceReport.findUnique({
    where: { id },
    include: { updates: { orderBy: { createdAt: 'asc' } } },
  })

  await broadcast({ kind: 'maintenance:update', payload: { report: updated } })
  return Response.json({ report: withUpdates })
}
