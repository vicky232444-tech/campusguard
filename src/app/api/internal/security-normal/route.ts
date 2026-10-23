import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { assertInternalSecret, broadcast } from '@/lib/broadcast'

/** POST /api/internal/security-normal — persist routine (non-suspicious) access events. */
export async function POST(req: NextRequest) {
  if (!assertInternalSecret(req)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as {
    zone: string
    area: string
    personName: string
    credential: string
    eventType: string
  }

  const event = await db.securityEvent.create({
    data: {
      zone: body.zone,
      area: body.area,
      personName: body.personName,
      credential: body.credential,
      eventType: body.eventType,
      detail: null,
      isSuspicious: false,
      isSimulated: true,
    },
  })

  await broadcast({ kind: 'security:event', payload: { event } })
  return Response.json({ ok: true })
}
