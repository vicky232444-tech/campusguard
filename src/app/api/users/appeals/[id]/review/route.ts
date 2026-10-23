import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, forbidden } from '@/lib/auth'

/** POST /api/users/appeals/[id]/review — Admin reviews suspension appeal and reinstates account */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (user.role !== 'ADMIN') return forbidden('Only administrative users can review suspension appeals.')

  const { id } = await context.params
  const body = (await req.json().catch(() => ({}))) as {
    action: 'APPROVE' | 'REJECT'
    adminNotes?: string
  }

  const appeal = await db.suspensionAppeal.findUnique({ where: { id } })
  if (!appeal) {
    return Response.json({ error: 'Appeal not found' }, { status: 404 })
  }

  const action = body.action || 'APPROVE'

  const updatedAppeal = await db.suspensionAppeal.update({
    where: { id },
    data: {
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      reviewedBy: user.name,
      reviewedAt: new Date(),
      adminNotes: body.adminNotes || (action === 'APPROVE' ? 'Appeal verified with supporting proof. Account reinstated.' : 'Appeal rejected due to insufficient or invalid evidence.'),
    },
  })

  // If approved, reinstate user account & reset warning count
  if (action === 'APPROVE') {
    await db.user.update({
      where: { id: appeal.userId },
      data: {
        isSuspended: false,
        warningCount: 0,
        suspendedAt: null,
        suspensionReason: null,
      },
    })
  }

  return Response.json({ appeal: updatedAppeal })
}
