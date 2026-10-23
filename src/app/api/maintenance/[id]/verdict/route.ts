import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/**
 * FINAL — Administrator reviews the AI results (authenticity + photo match)
 * and gives the final decision:
 *   - ACCEPT → report RESOLVED, derived alerts closed
 *   - REJECT → report sent back to maintenance as IN_PROGRESS (rework), any
 *     previous confirmation is cleared so the cycle can repeat.
 * Body: { decision: 'ACCEPT' | 'REJECT', note?: string }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.giveFinalVerdict(user.role)) return forbidden()

  const { id } = await ctx.params
  const { decision, note } = (await req.json()) as { decision?: 'ACCEPT' | 'REJECT'; note?: string }
  if (decision !== 'ACCEPT' && decision !== 'REJECT') {
    return Response.json({ error: 'decision must be ACCEPT or REJECT' }, { status: 400 })
  }

  const report = await db.maintenanceReport.findUnique({ where: { id } })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })
  if (report.status !== 'AWAITING_ADMIN') {
    return Response.json({ error: 'Final verdict is given after the reporter confirms (step 3)' }, { status: 400 })
  }

  if (decision === 'ACCEPT') {
    const updated = await db.maintenanceReport.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        finalVerdictBy: user.name,
        finalVerdictAt: new Date(),
        resolvedAt: new Date(),
      },
    })

    await db.reportUpdate.create({
      data: {
        reportId: id,
        status: 'RESOLVED',
        note: note?.trim() || `Administrator accepted the verified repair (AI authenticity + photo match passed). Closed by ${user.name}.`,
        by: user.name,
      },
    })

    await db.alert.updateMany({
      where: { sourceType: 'MaintenanceReport', sourceId: id, status: { not: 'RESOLVED' } },
      data: { status: 'RESOLVED', resolvedBy: user.name, resolvedAt: new Date() },
    })

    const withUpdates = await db.maintenanceReport.findUnique({
      where: { id },
      include: { updates: { orderBy: { createdAt: 'asc' } }, fines: { orderBy: { createdAt: 'desc' } } },
    })

    await broadcast({ kind: 'maintenance:update', payload: { report: updated } })
    return Response.json({ report: withUpdates })
  }

  // REJECT → back to maintenance for rework
  const updated = await db.maintenanceReport.update({
    where: { id },
    data: {
      status: 'IN_PROGRESS',
      reworkCount: { increment: 1 },
      userConfirmMedia: null,
      userConfirmNote: null,
      userConfirmAt: null,
      aiMatchVerdict: null,
      aiMatchScore: null,
      aiMatchNote: null,
      finalVerdictBy: user.name,
      finalVerdictAt: new Date(),
      resolvedAt: null,
    },
  })

  await db.reportUpdate.create({
    data: {
      reportId: id,
      status: 'IN_PROGRESS',
      note: note?.trim() || `Administrator sent the work back for rework (round ${(report.reworkCount ?? 0) + 1}). Fresh proof photo required.`,
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
