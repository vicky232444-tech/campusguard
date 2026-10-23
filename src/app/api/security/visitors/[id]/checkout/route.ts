import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** POST /api/security/visitors/[id]/checkout — mark visitor as checked out. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.manageSecurity(user.role)) return forbidden()

  const { id } = await ctx.params
  const visitor = await db.visitorLog.findUnique({ where: { id } })
  if (!visitor) return Response.json({ error: 'Visitor not found' }, { status: 404 })

  const updated = await db.visitorLog.update({
    where: { id },
    data: { status: 'CHECKED_OUT', checkOutAt: new Date() },
  })

  await broadcast({ kind: 'visitor:update', payload: { visitor: updated } })
  return Response.json({ visitor: updated })
}
