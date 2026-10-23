import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** POST /api/sensors/[id]/threshold — admin updates alert limits (Module 1 config). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.configureThresholds(user.role)) return forbidden()

  const { id } = await ctx.params
  const body = (await req.json()) as { minThreshold?: number; maxThreshold?: number }
  const sensor = await db.sensor.findUnique({ where: { id } })
  if (!sensor) return Response.json({ error: 'Sensor not found' }, { status: 404 })

  const min = typeof body.minThreshold === 'number' ? body.minThreshold : sensor.minThreshold
  const max = typeof body.maxThreshold === 'number' ? body.maxThreshold : sensor.maxThreshold
  if (min >= max) return Response.json({ error: 'Lower limit must be below upper limit' }, { status: 400 })

  const updated = await db.sensor.update({
    where: { id },
    data: { minThreshold: min, maxThreshold: max },
  })

  await broadcast({ kind: 'thresholds:update', payload: { sensor: updated } })
  return Response.json({ sensor: updated })
}
