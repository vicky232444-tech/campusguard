import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** GET /api/ratings — list worker ratings */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const isAdmin = user.role === 'ADMIN'

  const ratings = await db.workerRating.findMany({
    where: isAdmin ? {} : { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return Response.json({ ratings })
}

/** POST /api/ratings — user submits a rating for completed maintenance work */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (user.role === 'MAINTENANCE') {
    return forbidden('Maintenance team members cannot submit ratings.')
  }

  // Check if user is currently suspended
  const dbUser = await db.user.findUnique({ where: { id: user.id } })
  if (dbUser?.isSuspended) {
    return forbidden('Your account is currently suspended due to false rating submissions. Please submit an appeal.')
  }

  const body = (await req.json()) as {
    reportId: string
    stars: number
    feedback: string
    workQualityScore?: number
    timelinessScore?: number
    cleanlinessScore?: number
    userPhone: string
    consentGiven: boolean
  }

  if (!body.reportId || !body.feedback?.trim() || !body.stars) {
    return Response.json({ error: 'Report ID, feedback, and star rating are required.' }, { status: 400 })
  }

  if (!body.consentGiven) {
    return Response.json(
      { error: 'You must consent to the administrative phone verification policy before submitting a rating.' },
      { status: 400 }
    )
  }

  if (!body.userPhone || body.userPhone.trim().length < 8) {
    return Response.json({ error: 'Please provide a valid contact phone number for verification calls.' }, { status: 400 })
  }

  const report = await db.maintenanceReport.findUnique({
    where: { id: body.reportId },
  })

  if (!report) {
    return Response.json({ error: 'Associated maintenance report not found.' }, { status: 404 })
  }

  const workerName = report.assignedTo || 'Assigned Technician'

  const rating = await db.workerRating.create({
    data: {
      reportId: report.id,
      reportCode: report.code,
      userId: user.id,
      userName: user.name,
      userPhone: body.userPhone.trim(),
      workerName,
      workerCategory: report.category,
      stars: Math.max(1, Math.min(5, Number(body.stars))),
      feedback: body.feedback.trim(),
      workQualityScore: body.workQualityScore ?? 9,
      timelinessScore: body.timelinessScore ?? 9,
      cleanlinessScore: body.cleanlinessScore ?? 9,
      phoneConsentGiven: true,
      status: 'PENDING_ADMIN_REVIEW',
    },
  })

  // Alert Administrator of pending rating for review
  const alert = await db.alert.create({
    data: {
      type: 'MAINTENANCE',
      severity: 'INFO',
      title: `⭐ Worker Rating Submitted · ${workerName}`,
      message: `${user.name} submitted a ${body.stars}-star rating for ${workerName} (${report.code}). Awaiting Administrative genuineness review.`,
      zone: report.zone,
      sourceType: 'WorkerRating',
      sourceId: rating.id,
      status: 'ACTIVE',
    },
  })

  await broadcast({
    kind: 'maintenance:update',
    payload: { rating, alert },
  })

  return Response.json({ rating, alert }, { status: 201 })
}
