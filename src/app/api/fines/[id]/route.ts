import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** POST /api/fines/[id] — administrator can waive an issued fine. Body: { status: 'WAIVED' } */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.giveFinalVerdict(user.role)) return forbidden()

  const { id } = await ctx.params
  const { status } = (await req.json()) as { status?: string }
  if (status !== 'WAIVED') {
    return Response.json({ error: 'Only WAIVED is supported' }, { status: 400 })
  }

  const existing = await db.fine.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'Fine not found' }, { status: 404 })

  const fine = await db.fine.update({ where: { id }, data: { status: 'WAIVED' } })
  await broadcast({ kind: 'maintenance:update', payload: { reportCode: fine.reportCode } })
  return Response.json({ fine })
}
