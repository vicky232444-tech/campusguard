import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** POST /api/sos/[id] — acknowledge / resolve an SOS alert (responders). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const { id } = await ctx.params
  const { action } = (await req.json()) as { action: 'ack' | 'resolve' }

  if (action === 'ack' && !can.ackSos(user.role)) return forbidden()
  if (action === 'resolve' && !can.resolveSos(user.role)) return forbidden()

  const sos = await db.sosAlert.findUnique({ where: { id } })
  if (!sos) return Response.json({ error: 'SOS not found' }, { status: 404 })
  if (sos.status === 'RESOLVED') return Response.json({ error: 'SOS already resolved' }, { status: 400 })

  const updated = await db.sosAlert.update({
    where: { id },
    data:
      action === 'ack'
        ? { status: 'ACKNOWLEDGED', acknowledgedBy: user.name, acknowledgedAt: new Date() }
        : { status: 'RESOLVED', resolvedBy: user.name, resolvedAt: new Date() },
  })

  // Keep the derived alert in sync
  if (sos.id) {
    await db.alert.updateMany({
      where: { sourceType: 'SosAlert', sourceId: sos.id, status: { not: 'RESOLVED' } },
      data:
        action === 'ack'
          ? { status: 'ACKNOWLEDGED', acknowledgedBy: user.name, acknowledgedAt: new Date() }
          : { status: 'RESOLVED', resolvedBy: user.name, resolvedAt: new Date() },
    })
  }

  await broadcast({ kind: 'sos:update', payload: { sos: updated } })
  return Response.json({ sos: updated })
}
