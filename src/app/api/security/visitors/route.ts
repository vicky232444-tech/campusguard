import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** GET /api/security/visitors — visitor register. */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.viewSecurity(user.role)) return forbidden()

  const visitors = await db.visitorLog.findMany({ orderBy: { checkInAt: 'desc' }, take: 100 })
  return Response.json({ visitors })
}

/** POST /api/security/visitors — front-desk check-in. */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.manageSecurity(user.role)) return forbidden()

  const body = (await req.json()) as {
    visitorName: string
    phone?: string
    purpose: string
    hostName: string
    zone?: string
  }
  if (!body.visitorName?.trim() || !body.purpose?.trim() || !body.hostName?.trim()) {
    return Response.json({ error: 'Visitor name, purpose and host are required' }, { status: 400 })
  }

  const passNo = `VP-${Math.floor(1000 + Math.random() * 9000)}`
  const visitor = await db.visitorLog.create({
    data: {
      visitorName: body.visitorName.trim(),
      phone: body.phone?.trim() || null,
      purpose: body.purpose.trim(),
      hostName: body.hostName.trim(),
      zone: body.zone || null,
      passNo,
      status: 'INSIDE',
    },
  })

  await broadcast({ kind: 'visitor:update', payload: { visitor } })
  return Response.json({ visitor })
}
