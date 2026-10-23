import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'

/** GET /api/sensors/[id]/readings?minutes=120 — trend history for charts. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await ctx.params
  const minutes = Math.min(Number(req.nextUrl.searchParams.get('minutes') ?? 120), 720)
  const since = new Date(Date.now() - minutes * 60 * 1000)

  const readings = await db.sensorReading.findMany({
    where: { sensorId: id, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    take: 400,
  })
  return Response.json({ readings })
}
