import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** POST /api/ratings/[id]/reject — Admin rejects false rating, issues warning, and triggers suspension if 3 warnings in 6 months */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (user.role !== 'ADMIN') return forbidden('Only administrative users can reject ratings and issue warnings.')

  const { id } = await context.params
  const body = (await req.json().catch(() => ({}))) as {
    reason?: string
  }

  const rejectionReason = body.reason?.trim() || 'Rating details could not be verified / detected as exaggerated or false.'

  const rating = await db.workerRating.findUnique({ where: { id } })
  if (!rating) {
    return Response.json({ error: 'Rating record not found' }, { status: 404 })
  }

  // 1. Mark rating as REJECTED_FALSE (not passed to worker)
  const updatedRating = await db.workerRating.update({
    where: { id },
    data: {
      status: 'REJECTED_FALSE',
      reviewedBy: user.name,
      reviewedAt: new Date(),
      rejectionReason,
    },
  })

  // 2. Fetch rating author user and evaluate 6-month warning window
  const ratingUser = await db.user.findUnique({ where: { id: rating.userId } })
  if (ratingUser) {
    const now = Date.now()
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000

    let currentWarnings = ratingUser.warningCount || 0

    // Reset warnings if last warning was > 6 months ago
    if (ratingUser.lastWarningAt && now - ratingUser.lastWarningAt.getTime() > SIX_MONTHS_MS) {
      currentWarnings = 0
    }

    const newWarningCount = currentWarnings + 1
    const shouldSuspend = newWarningCount >= 3

    await db.user.update({
      where: { id: ratingUser.id },
      data: {
        warningCount: newWarningCount,
        lastWarningAt: new Date(),
        isSuspended: shouldSuspend,
        suspendedAt: shouldSuspend ? new Date() : ratingUser.suspendedAt,
        suspensionReason: shouldSuspend
          ? `Account suspended: 3 false or exaggerated rating submissions within a 6-month period. Reason: ${rejectionReason}`
          : ratingUser.suspensionReason,
      },
    })

    // Create alert to inform the user of warning & rejection
    await db.alert.create({
      data: {
        type: 'SECURITY',
        severity: shouldSuspend ? 'CRITICAL' : 'HIGH',
        title: shouldSuspend ? '⚠️ Account Suspended: 3 False Rating Flags' : `⚠️ Warning Issued: False Rating Detected (${newWarningCount}/3)`,
        message: shouldSuspend
          ? `Your account has been temporarily suspended following 3 false rating submissions. Reason: "${rejectionReason}". You may submit an appeal from your portal.`
          : `Your rating for ${rating.workerName} was rejected. Reason: "${rejectionReason}". Warning ${newWarningCount}/3 issued. 3 warnings in 6 months results in account suspension.`,
        sourceType: 'WorkerRating',
        sourceId: rating.id,
        status: 'ACTIVE',
      },
    })
  }

  await broadcast({
    kind: 'maintenance:update',
    payload: { rating: updatedRating },
  })

  return Response.json({ rating: updatedRating })
}
