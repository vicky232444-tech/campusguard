import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** POST /api/sos/requests/[id]/approve — Administrator approves and fires campus-wide SOS */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (user.role !== 'ADMIN') return forbidden('Only administrators can approve and trigger campus-wide SOS broadcasts')

  const { id } = await context.params

  const request = await db.sosBroadcastRequest.findUnique({ where: { id } })
  if (!request) {
    return Response.json({ error: 'Request not found' }, { status: 404 })
  }
  if (request.status !== 'PENDING') {
    return Response.json({ error: `Request already ${request.status.toLowerCase()}` }, { status: 400 })
  }

  // 1. Mark request as APPROVED
  const updatedRequest = await db.sosBroadcastRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewedBy: user.name,
      reviewedAt: new Date(),
    },
  })

  // 2. Automatically spawn the Mass SOS Alert across all campus devices
  const sos = await db.sosAlert.create({
    data: {
      triggeredById: request.requestedById,
      triggeredBy: `${request.requestedByName} [Approved by Admin ${user.name}]`,
      role: request.requestedRole,
      emergencyType: request.emergencyType,
      message: `[CAMPUS BROADCAST] ${request.reason}`,
      shareLocation: true,
      locationText: request.zone || 'Campus-Wide',
      isMassBroadcast: true,
      triggerSource: 'APPROVED_REQUEST',
      requestId: request.id,
      status: 'ACTIVE',
    },
  })

  // 3. Create high-priority cross-module alert
  const alert = await db.alert.create({
    data: {
      type: 'SOS',
      severity: 'CRITICAL',
      title: `🚨 CAMPUS-WIDE EMERGENCY · ${request.emergencyType.replaceAll('_', ' ')}`,
      message: `Administrator approved broadcast requested by ${request.requestedByName} (${request.requestedRole}): "${request.reason}". Evacuation protocols initiated.`,
      zone: request.zone || 'Campus-Wide',
      sourceType: 'SosAlert',
      sourceId: sos.id,
      status: 'ACTIVE',
    },
  })

  // 4. Live Broadcast to all devices
  await broadcast({
    kind: 'sos:new',
    payload: { sos, alert, isMassBroadcast: true, approvedFromRequest: id },
  })

  return Response.json({ request: updatedRequest, sos, alert })
}
