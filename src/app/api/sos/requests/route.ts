import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** GET /api/sos/requests — list SOS broadcast permission requests */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const isAdmin = user.role === 'ADMIN'
  const isSecurity = user.role === 'SECURITY'

  // Admin and Security see all requests; regular users see only their own
  const requests = await db.sosBroadcastRequest.findMany({
    where: isAdmin || isSecurity ? {} : { requestedById: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return Response.json({ requests })
}

/** POST /api/sos/requests — regular user submits request for campus-wide SOS */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const body = (await req.json()) as {
    emergencyType: string
    zone?: string
    reason: string
    targetAudience?: string
  }

  if (!body.reason || body.reason.trim().length < 3) {
    return Response.json({ error: 'Please describe the emergency reason in detail.' }, { status: 400 })
  }

  const validTypes = ['MEDICAL', 'FIRE', 'SECURITY_THREAT', 'ACCIDENT', 'OTHER']
  if (!validTypes.includes(body.emergencyType)) {
    return Response.json({ error: 'Invalid emergency type' }, { status: 400 })
  }

  const request = await db.sosBroadcastRequest.create({
    data: {
      requestedById: user.id,
      requestedByName: user.name,
      requestedRole: user.role,
      emergencyType: body.emergencyType,
      zone: body.zone || 'Campus Wide',
      reason: body.reason.trim(),
      targetAudience: body.targetAudience || 'ALL_CAMPUS_DEVICES',
      status: 'PENDING',
    },
  })

  // Alert Admins and Security team about this pending broadcast request
  const alert = await db.alert.create({
    data: {
      type: 'SOS',
      severity: 'HIGH',
      title: `⚠️ SOS Broadcast Requested · ${body.emergencyType.replaceAll('_', ' ')}`,
      message: `${user.name} (${user.role.toLowerCase()}) requested campus-wide SOS permission for ${body.zone || 'Campus'}: "${body.reason}". Awaiting Administrator Review.`,
      zone: body.zone || null,
      sourceType: 'SosBroadcastRequest',
      sourceId: request.id,
      status: 'ACTIVE',
    },
  })

  await broadcast({
    kind: 'sos:update',
    payload: { request, alert },
  })

  return Response.json({ request, alert }, { status: 201 })
}
