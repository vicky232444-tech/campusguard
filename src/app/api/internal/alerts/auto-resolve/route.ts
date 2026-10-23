import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { assertInternalSecret, broadcast } from '@/lib/broadcast'

/**
 * POST /api/internal/alerts/auto-resolve — when a simulated reading returns
 * to its safe range, automatically close its active sensor alert.
 */
export async function POST(req: NextRequest) {
  if (!assertInternalSecret(req)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { sourceId } = (await req.json()) as { sourceId: string }
  if (!sourceId) return Response.json({ error: 'sourceId required' }, { status: 400 })

  const active = await db.alert.findFirst({
    where: { sourceId, type: 'SENSOR', status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } },
  })
  if (!active) return Response.json({ ok: true, resolved: false })

  const alert = await db.alert.update({
    where: { id: active.id },
    data: { status: 'RESOLVED', resolvedBy: 'system-auto', resolvedAt: new Date() },
  })

  await broadcast({ kind: 'alert:update', payload: { alert } })
  return Response.json({ ok: true, resolved: true })
}
