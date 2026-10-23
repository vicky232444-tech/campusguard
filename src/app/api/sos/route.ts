import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** GET /api/sos — SOS list (staff+ see all; students see own). */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const isResponder = ['STAFF', 'SECURITY', 'MAINTENANCE', 'ADMIN'].includes(user.role)
  const sos = await db.sosAlert.findMany({
    where: isResponder ? {} : { triggeredById: user.id },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })
  return Response.json({ sos })
}

/** POST /api/sos — trigger an emergency SOS (Module 3). */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const body = (await req.json()) as {
    emergencyType: string
    message?: string
    shareLocation?: boolean
    latitude?: number | null
    longitude?: number | null
    locationText?: string
    isMassBroadcast?: boolean
    triggerSource?: 'MANUAL_ADMIN' | 'MANUAL_USER' | 'APPROVED_REQUEST' | 'AUTO_DISASTER'
  }

  const validTypes = ['MEDICAL', 'FIRE', 'SECURITY_THREAT', 'ACCIDENT', 'OTHER']
  if (!validTypes.includes(body.emergencyType)) {
    return Response.json({ error: 'Invalid emergency type' }, { status: 400 })
  }

  // SOS ACCESS CONTROL: Only Administrator can trigger mass broadcast across all devices
  const wantsMassBroadcast = body.isMassBroadcast === true
  if (wantsMassBroadcast && user.role !== 'ADMIN') {
    return Response.json(
      { error: 'Unauthorized: Only administrators have direct permission to trigger SOS across all devices. Please submit an Admin Approval Request.' },
      { status: 403 }
    )
  }

  const isMassBroadcast = user.role === 'ADMIN' ? wantsMassBroadcast : false
  const triggerSource = user.role === 'ADMIN' && wantsMassBroadcast
    ? 'MANUAL_ADMIN'
    : (body.triggerSource || 'MANUAL_USER')

  const shareLocation = body.shareLocation === true // privacy: opt-in only
  const hasCoords = shareLocation && typeof body.latitude === 'number' && typeof body.longitude === 'number'

  const sos = await db.sosAlert.create({
    data: {
      triggeredById: user.id,
      triggeredBy: user.name,
      role: user.role,
      emergencyType: body.emergencyType,
      message: body.message?.trim() || null,
      shareLocation,
      latitude: hasCoords ? (body.latitude as number) : null,
      longitude: hasCoords ? (body.longitude as number) : null,
      locationText: body.locationText || null,
      isMassBroadcast,
      triggerSource,
      status: 'ACTIVE',
    },
  })

  // Cross-module alert so the dashboard & notification center pick it up
  const alertTitle = isMassBroadcast
    ? `🚨 CAMPUS-WIDE SOS · ${body.emergencyType.replaceAll('_', ' ')}`
    : `Personal SOS · ${body.emergencyType.replaceAll('_', ' ')}`

  const alertMessage = isMassBroadcast
    ? `ALL-DEVICES EMERGENCY EVACUATION triggered by Administrator (${user.name})${body.locationText ? ` for ${body.locationText}` : ''}: ${body.message || 'Immediate safety protocols active across campus.'}`
    : `${user.name} (${user.role.replace('_', ' ').toLowerCase()}) triggered a personal distress alert${body.locationText ? ` at ${body.locationText}` : ''}. Security team dispatched.`

  const alert = await db.alert.create({
    data: {
      type: 'SOS',
      severity: 'CRITICAL',
      title: alertTitle,
      message: alertMessage,
      zone: body.locationText || null,
      sourceType: 'SosAlert',
      sourceId: sos.id,
      status: 'ACTIVE',
    },
  })

  await broadcast({
    kind: 'sos:new',
    payload: { sos, alert, isMassBroadcast },
  })

  return Response.json({ sos, alert })
}
