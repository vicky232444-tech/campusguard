import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** POST /api/ratings/[id]/approve — Admin approves genuine rating and awards it to worker */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (user.role !== 'ADMIN') return forbidden('Only administrative users can approve ratings.')

  const { id } = await context.params
  const body = (await req.json().catch(() => ({}))) as { adminNotes?: string }

  const rating = await db.workerRating.findUnique({ where: { id } })
  if (!rating) {
    return Response.json({ error: 'Rating record not found' }, { status: 404 })
  }

  const updated = await db.workerRating.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewedBy: user.name,
      reviewedAt: new Date(),
      adminNotes: body.adminNotes || 'Rating details verified and approved. Passed to technician profile with priority recommendation boost.',
    },
  })

  await broadcast({
    kind: 'maintenance:update',
    payload: { rating: updated },
  })

  return Response.json({ rating: updated })
}
