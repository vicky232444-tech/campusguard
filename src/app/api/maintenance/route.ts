import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

/** GET /api/maintenance — repair requests (students see own; staff+ see all). */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const seeAll = can.viewAllReports(user.role)
  const reports = await db.maintenanceReport.findMany({
    where: seeAll ? {} : { reportedById: user.id },
    orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
    take: 120,
  })

  // Students/staff: attach their own timeline too (small data)
  const withUpdates = await Promise.all(
    reports.map(async (r) => ({
      ...r,
      updates: await db.reportUpdate.findMany({ where: { reportId: r.id }, orderBy: { createdAt: 'asc' } }),
      fines: await db.fine.findMany({ where: { reportId: r.id }, orderBy: { createdAt: 'desc' } }),
    })),
  )

  return Response.json({ reports: withUpdates })
}

/** POST /api/maintenance — report a fault (all roles). */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const body = (await req.json()) as {
    category: string
    title: string
    description: string
    zone: string
    location?: string
    priority?: string
    photoData?: string | null
    assignedTo?: string
  }

  const categories = ['ELECTRICAL', 'PLUMBING', 'HVAC', 'STRUCTURAL', 'FURNITURE', 'EQUIPMENT', 'SAFETY']
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
  if (!categories.includes(body.category)) return Response.json({ error: 'Invalid category' }, { status: 400 })
  if (body.priority && !priorities.includes(body.priority)) return Response.json({ error: 'Invalid priority' }, { status: 400 })
  if (!body.title?.trim() || !body.description?.trim() || !body.zone) {
    return Response.json({ error: 'Title, description and zone are required' }, { status: 400 })
  }
  if (body.photoData && body.photoData.length > 1_500_000) {
    return Response.json({ error: 'Photo too large — please choose a smaller image' }, { status: 400 })
  }

  const count = await db.maintenanceReport.count()
  const code = `MR-${String(count + 1).padStart(4, '0')}`

  const report = await db.maintenanceReport.create({
    data: {
      code,
      reportedById: user.id,
      reportedBy: user.name,
      category: body.category,
      title: body.title.trim(),
      description: body.description.trim(),
      zone: body.zone,
      location: body.location?.trim() || null,
      priority: body.priority || 'MEDIUM',
      photoData: body.photoData || null,
      assignedTo: body.assignedTo?.trim() || null,
      status: 'PENDING',
    },
  })

  await db.reportUpdate.create({
    data: { reportId: report.id, status: 'PENDING', note: 'Report submitted', by: user.name },
  })

  // Urgent faults raise an alert for the command center
  if (report.priority === 'URGENT' || report.priority === 'HIGH') {
    await db.alert.create({
      data: {
        type: 'MAINTENANCE',
        severity: report.priority === 'URGENT' ? 'CRITICAL' : 'MEDIUM',
        title: `${report.priority === 'URGENT' ? 'URGENT' : 'High priority'} fault reported`,
        message: `${report.code} — ${report.title} (${report.zone}).`,
        zone: report.zone,
        sourceType: 'MaintenanceReport',
        sourceId: report.id,
        status: 'ACTIVE',
      },
    })
  }

  await broadcast({ kind: 'maintenance:new', payload: { report } })
  return Response.json({ report })
}
