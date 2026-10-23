import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'

/** GET /api/alerts?status=&type=&limit= — alert inbox / incident history. */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const type = sp.get('type')
  const limit = Math.min(Number(sp.get('limit') ?? 50), 200)

  const alerts = await db.alert.findMany({
    where: {
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(type && type !== 'ALL' ? { type } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return Response.json({ alerts })
}
