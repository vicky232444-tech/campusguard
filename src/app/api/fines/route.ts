import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized } from '@/lib/auth'

/** GET /api/fines — penalties for morphed proof uploads (admin: all, maintenance: own). */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.viewFines(user.role)) return Response.json({ fines: [] })

  const fines = await db.fine.findMany({
    where: user.role === 'ADMIN' ? {} : { finedToId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return Response.json({ fines })
}
