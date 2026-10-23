import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'

/** GET /api/security/events — access & intrusion log (Module 2). */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.viewSecurity(user.role)) return forbidden()

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 80), 300)
  const events = await db.securityEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return Response.json({ events })
}
