import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { assertInternalSecret, broadcast } from '@/lib/broadcast'

/** POST /api/internal/alerts — sim service raises a sensor anomaly alert (deduped). */
export async function POST(req: NextRequest) {
  if (!assertInternalSecret(req)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as {
    type: 'SENSOR' | 'SECURITY'
    severity: 'INFO' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    title: string
    message: string
    zone?: string
    sourceType?: string
    sourceId?: string
    dedupKey?: string // e.g. sensor id — prevents alert storms
    securityEvent?: {
      zone: string
      area: string
      personName: string
      credential: string
      eventType: string
      detail?: string
      isSuspicious: boolean
    }
  }

  // Dedup: skip if a non-resolved alert for the same source exists (2 min window)
  if (body.sourceId) {
    const existing = await db.alert.findFirst({
      where: {
        sourceId: body.sourceId,
        type: body.type,
        status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
      },
    })
    if (existing) return Response.json({ ok: true, created: false, alert: existing })
  }

  let securityEventId: string | null = null
  if (body.securityEvent) {
    const se = await db.securityEvent.create({
      data: {
        zone: body.securityEvent.zone,
        area: body.securityEvent.area,
        personName: body.securityEvent.personName,
        credential: body.securityEvent.credential,
        eventType: body.securityEvent.eventType,
        detail: body.securityEvent.detail ?? null,
        isSuspicious: body.securityEvent.isSuspicious,
        isSimulated: true,
      },
    })
    securityEventId = se.id
    await broadcast({ kind: 'security:event', payload: { event: se } })
  }

  const alert = await db.alert.create({
    data: {
      type: body.type,
      severity: body.severity,
      title: body.title,
      message: body.message,
      zone: body.zone ?? null,
      sourceType: body.sourceType ?? null,
      sourceId: body.sourceId ?? securityEventId ?? null,
      status: 'ACTIVE',
    },
  })

  await broadcast({ kind: 'alert:new', payload: { alert } })
  return Response.json({ ok: true, created: true, alert })
}
