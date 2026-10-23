import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** GET /api/users/appeals — list suspension appeals */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const isAdmin = user.role === 'ADMIN'

  const appeals = await db.suspensionAppeal.findMany({
    where: isAdmin ? {} : { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return Response.json({ appeals })
}

/** POST /api/users/appeals — suspended user submits reinstatement appeal */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const body = (await req.json()) as {
    explanation: string
    proofMedia?: string
    userPhone?: string
  }

  if (!body.explanation || body.explanation.trim().length < 10) {
    return Response.json({ error: 'Please provide a detailed written explanation for your appeal (at least 10 characters).' }, { status: 400 })
  }

  const appeal = await db.suspensionAppeal.create({
    data: {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userPhone: body.userPhone || null,
      explanation: body.explanation.trim(),
      proofMedia: body.proofMedia || null,
      status: 'PENDING',
    },
  })

  // Alert Administrator of pending appeal
  const alert = await db.alert.create({
    data: {
      type: 'SECURITY',
      severity: 'HIGH',
      title: `📝 Suspension Appeal Submitted · ${user.name}`,
      message: `Suspended user ${user.name} submitted an account reinstatement appeal with supporting proof. Awaiting administrative review.`,
      sourceType: 'SuspensionAppeal',
      sourceId: appeal.id,
      status: 'ACTIVE',
    },
  })

  await broadcast({
    kind: 'alert:new',
    payload: { alert },
  })

  return Response.json({ appeal }, { status: 201 })
}
