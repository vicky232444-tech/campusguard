import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'

/** GET /api/sensors — all sensors with latest values. */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const sensors = await db.sensor.findMany({ orderBy: { code: 'asc' } })
  return Response.json({ sensors })
}
