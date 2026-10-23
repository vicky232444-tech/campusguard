import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'
import { matchRepairPhotos } from '@/lib/ai-verify'

/**
 * STEP 3 — The person who reported the fault uploads their own confirmation
 * photo of the fixed work. The AI engine cross-matches it against the
 * maintenance team's proof photo:
 *   - MATCHED / MISMATCHED → report moves to AWAITING_ADMIN with the verdict
 *     attached; the administrator gives the final accept / rework decision.
 * Body: { confirmMedia: string (data URL), note?: string }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const { id } = await ctx.params
  const { confirmMedia, note } = (await req.json()) as { confirmMedia?: string; note?: string }

  if (!confirmMedia || !confirmMedia.startsWith('data:image/')) {
    return Response.json({ error: 'A confirmation photo is required' }, { status: 400 })
  }
  if (confirmMedia.length > 1_500_000) {
    return Response.json({ error: 'Photo too large — please choose a smaller image' }, { status: 400 })
  }

  const report = await db.maintenanceReport.findUnique({ where: { id } })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })
  if (report.status !== 'PROOF_SUBMITTED') {
    return Response.json({ error: 'Confirmation is only possible once maintenance has submitted authentic proof' }, { status: 400 })
  }

  // Only the original reporter (or an admin on their behalf) may confirm
  const isReporter = report.reportedById === user.id || report.reportedBy === user.name
  if (!isReporter && user.role !== 'ADMIN') return forbidden()

  if (!report.proofMedia) {
    return Response.json({ error: 'Maintenance proof photo is missing' }, { status: 400 })
  }

  // ── AI cross-match between proof & confirmation ───────────────────────────
  const ai = await matchRepairPhotos(report.proofMedia, confirmMedia, {
    code: report.code,
    title: report.title,
    zone: report.zone,
  })

  const updated = await db.maintenanceReport.update({
    where: { id },
    data: {
      status: 'AWAITING_ADMIN',
      userConfirmMedia: confirmMedia,
      userConfirmNote: note?.trim() || null,
      userConfirmAt: new Date(),
      aiMatchVerdict: ai.verdict,
      aiMatchScore: ai.score,
      aiMatchNote: ai.note,
    },
  })

  await db.reportUpdate.create({
    data: {
      reportId: id,
      status: 'AWAITING_ADMIN',
      note:
        ai.verdict === 'MATCHED'
          ? `Reporter uploaded confirmation photo. Awaiting final administrator decision.`
          : ai.verdict === 'MISMATCHED'
            ? `Reporter uploaded confirmation photo — flagged for administrator review.`
            : `Confirmation photo submitted — flagged for administrator review.`,
      by: user.name,
    },
  })

  // Mismatch raises an alert for the command center
  if (ai.verdict === 'MISMATCHED') {
    await db.alert.create({
      data: {
        type: 'MAINTENANCE',
        severity: 'MEDIUM',
        title: `Confirmation mismatch on ${report.code}`,
        message: `Reporter's confirmation photo does not match maintenance proof for ${report.code} — "${report.title}" (${ai.score}% similarity). Administrator review required.`,
        zone: report.zone,
        sourceType: 'MaintenanceReport',
        sourceId: report.id,
        status: 'ACTIVE',
      },
    })
  }

  const withUpdates = await db.maintenanceReport.findUnique({
    where: { id },
    include: { updates: { orderBy: { createdAt: 'asc' } }, fines: { orderBy: { createdAt: 'desc' } } },
  })

  await broadcast({ kind: 'maintenance:update', payload: { report: updated } })
  return Response.json({ report: withUpdates, ai })
}
