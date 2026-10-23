import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** POST /api/alerts/[id] — acknowledge or resolve an alert. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const { id } = await ctx.params
  const { action } = (await req.json()) as { action: 'ack' | 'resolve' }

  if (action === 'ack' && !can.ackAlert(user.role)) return forbidden()
  if (action === 'resolve' && !can.resolveAlert(user.role)) return forbidden()

  const alert = await db.alert.findUnique({ where: { id } })
  if (!alert) return Response.json({ error: 'Alert not found' }, { status: 404 })
  if (alert.status === 'RESOLVED') return Response.json({ error: 'Alert already resolved' }, { status: 400 })

  const updated = await db.alert.update({
    where: { id },
    data:
      action === 'ack'
        ? { status: 'ACKNOWLEDGED', acknowledgedBy: user.name, acknowledgedAt: new Date() }
        : { status: 'RESOLVED', resolvedBy: user.name, resolvedAt: new Date() },
  })

  await broadcast({ kind: 'alert:update', payload: { alert: updated } })
  return Response.json({ alert: updated })
}
