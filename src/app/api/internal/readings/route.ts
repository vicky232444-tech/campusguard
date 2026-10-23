import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { assertInternalSecret } from '@/lib/broadcast'

type IncomingReading = {
  sensorId: string
  value: number
  isAnomaly: boolean
  status: 'NORMAL' | 'WARNING' | 'CRITICAL'
}

/** POST /api/internal/readings — ingest simulated readings batch (sim service). */
export async function POST(req: NextRequest) {
  if (!assertInternalSecret(req)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { readings } = (await req.json()) as { readings: IncomingReading[] }
  if (!Array.isArray(readings) || readings.length === 0) {
    return Response.json({ error: 'readings[] required' }, { status: 400 })
  }

  await db.sensorReading.createMany({
    data: readings.map((r) => ({
      sensorId: r.sensorId,
      value: r.value,
      isAnomaly: r.isAnomaly,
    })),
  })

  await Promise.all(
    readings.map((r) =>
      db.sensor.update({
        where: { id: r.sensorId },
        data: { lastValue: r.value, lastStatus: r.status },
      }),
    ),
  )

  return Response.json({ ok: true, count: readings.length })
}
