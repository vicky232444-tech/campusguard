import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** POST /api/sos/requests/[id]/reject — Administrator rejects a mass SOS request */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (user.role !== 'ADMIN') return forbidden('Only administrators can review broadcast requests')

  const { id } = await context.params
  const body = (await req.json().catch(() => ({}))) as { reason?: string }

  const request = await db.sosBroadcastRequest.findUnique({ where: { id } })
  if (!request) {
    return Response.json({ error: 'Request not found' }, { status: 404 })
  }

  const updatedRequest = await db.sosBroadcastRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedBy: user.name,
      reviewedAt: new Date(),
      rejectionReason: body.reason?.trim() || 'Declined by Administrator after verification.',
    },
  })

  await broadcast({
    kind: 'sos:update',
    payload: { request: updatedRequest },
  })

  return Response.json({ request: updatedRequest })
}
