import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, forbidden } from '@/lib/auth'

/** POST /api/ratings/[id]/verify-call — Admin simulates automated in-app verification call to user */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (user.role !== 'ADMIN') return forbidden('Only administrative users can execute rating verification calls.')

  const { id } = await context.params
  const body = (await req.json().catch(() => ({}))) as {
    callVerdict?: 'CONFIRMED_GENUINE' | 'SUSPICIOUS_UNRESPONSIVE' | 'CALL_FAILED'
    notes?: string
  }

  const rating = await db.workerRating.findUnique({ where: { id } })
  if (!rating) {
    return Response.json({ error: 'Rating record not found' }, { status: 404 })
  }

  const callNotes = body.notes || `Automated verification call connected to ${rating.userPhone}. User confirmed work execution for complaint ${rating.reportCode} by ${rating.workerName}. Details verified genuine.`

  const updated = await db.workerRating.update({
    where: { id },
    data: {
      status: 'CALL_VERIFIED',
      verificationCallAt: new Date(),
      verificationCallNotes: callNotes,
    },
  })

  return Response.json({ rating: updated })
}
