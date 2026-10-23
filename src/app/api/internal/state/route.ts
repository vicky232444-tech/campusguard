import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { assertInternalSecret } from '@/lib/broadcast'

/** GET /api/internal/state — sim service bootstraps sensor config from here. */
export async function GET(req: NextRequest) {
  if (!assertInternalSecret(req)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const sensors = await db.sensor.findMany({
    select: {
      id: true, code: true, name: true, type: true, zone: true, location: true,
      unit: true, minThreshold: true, maxThreshold: true, baseline: true, lastValue: true,
    },
    orderBy: { code: 'asc' },
  })
  return Response.json({ sensors })
}
