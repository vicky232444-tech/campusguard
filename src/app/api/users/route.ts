import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'

/** GET /api/users?role=MAINTENANCE — directory for admin forwarding (admin only). */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.approveReport(user.role)) return forbidden()

  const role = req.nextUrl.searchParams.get('role') ?? 'MAINTENANCE'
  const users = await db.user.findMany({
    where: { role },
    select: { id: true, name: true, role: true, dept: true },
    orderBy: { name: 'asc' },
  })
  return Response.json({ users })
}
