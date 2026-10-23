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
  }

  const validTypes = ['MEDICAL', 'FIRE', 'SECURITY_THREAT', 'ACCIDENT', 'OTHER']
  if (!validTypes.includes(body.emergencyType)) {
    return Response.json({ error: 'Invalid emergency type' }, { status: 400 })
  }

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
      status: 'ACTIVE',
    },
  })

  // Cross-module alert so the dashboard & notification center pick it up
  const alert = await db.alert.create({
    data: {
      type: 'SOS',
      severity: 'CRITICAL',
      title: `SOS · ${body.emergencyType.replaceAll('_', ' ')}`,
      message: `${user.name} (${user.role.replace('_', ' ').toLowerCase()}) triggered an emergency alert${body.locationText ? ` at ${body.locationText}` : ''}.`,
      zone: body.locationText || null,
      sourceType: 'SosAlert',
      sourceId: sos.id,
      status: 'ACTIVE',
    },
  })

  await broadcast({ kind: 'sos:new', payload: { sos, alert } })
  return Response.json({ sos, alert })
}
