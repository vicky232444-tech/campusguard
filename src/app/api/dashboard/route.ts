import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { ZONES } from '@/lib/types'

/** GET /api/dashboard — central dashboard aggregate (Module 5). */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000)

  const [alerts, sensors, sos, reports, visitors, suspicious, secToday] = await Promise.all([
    db.alert.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
    db.sensor.findMany({ orderBy: { code: 'asc' } }),
    db.sosAlert.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.maintenanceReport.findMany({ orderBy: { updatedAt: 'desc' }, take: 40 }),
    db.visitorLog.findMany({ where: { status: 'INSIDE' } }),
    db.securityEvent.count({ where: { isSuspicious: true, createdAt: { gte: dayAgo } } }),
    db.securityEvent.count({ where: { createdAt: { gte: dayAgo } } }),
  ])

  const activeAlerts = alerts.filter((a) => a.status !== 'RESOLVED')
  const activeSos = sos.filter((s) => s.status !== 'RESOLVED')
  const openRepairs = reports.filter((r) => r.status !== 'RESOLVED')

  // Zone status aggregation
  const zoneStatus = ZONES.map((zone) => {
    const zSensors = sensors.filter((s) => s.zone === zone)
    const abnormalSensors = zSensors.filter((s) => s.lastStatus !== 'NORMAL').length
    const zAlerts = activeAlerts.filter((a) => a.zone === zone).length
    const zRepairs = openRepairs.filter((r) => r.zone === zone).length
    const urgent = openRepairs.some((r) => r.zone === zone && r.priority === 'URGENT')
    const criticalSos = activeSos.some((s) => s.locationText === zone)
    const status: 'NORMAL' | 'ATTENTION' | 'CRITICAL' =
      criticalSos || urgent || zAlerts >= 2 || abnormalSensors >= 2 ? 'CRITICAL'
        : abnormalSensors > 0 || zAlerts > 0 || zRepairs > 0 ? 'ATTENTION'
          : 'NORMAL'
    return { zone, abnormalSensors, totalSensors: zSensors.length, activeAlerts: zAlerts, openRepairs: zRepairs, status }
  })

  // Alert severity distribution (24 h)
  const recentAlerts = alerts.filter((a) => new Date(a.createdAt) >= dayAgo)
  const severityOf = (s: string) => ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO'].includes(s) ? s : 'MEDIUM'
  const alertSeverity = ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO'].map((severity) => ({
    severity,
    count: recentAlerts.filter((a) => severityOf(a.severity) === severity).length,
  }))

  const repairStatus = ['PENDING', 'IN_PROGRESS', 'RESOLVED'].map((status) => ({
    status,
    count: reports.filter((r) => r.status === status).length,
  }))

  // Merged recent activity feed
  const recent = [
    ...alerts.slice(0, 12).map((a) => ({
      id: a.id, kind: 'alert' as const, title: a.title, detail: a.message,
      severity: a.severity, status: a.status, at: a.createdAt.toISOString(),
    })),
    ...sos.slice(0, 6).map((s) => ({
      id: s.id, kind: 'sos' as const,
      title: `SOS · ${s.emergencyType.replaceAll('_', ' ')}`,
      detail: `${s.triggeredBy} (${s.role}) — ${s.locationText ?? 'location not shared'}`,
      severity: 'CRITICAL', status: s.status, at: s.createdAt.toISOString(),
    })),
    ...reports.slice(0, 8).map((r) => ({
      id: r.id, kind: 'maintenance' as const,
      title: `${r.code} · ${r.title}`,
      detail: `${r.zone} · priority ${r.priority.toLowerCase()} · ${r.status.replaceAll('_', ' ').toLowerCase()}`,
      severity: r.priority, status: r.status, at: r.updatedAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 15)

  return Response.json({
    stats: {
      activeAlerts: activeAlerts.length,
      activeSos: activeSos.length,
      openRepairs: openRepairs.length,
      urgentRepairs: openRepairs.filter((r) => r.priority === 'URGENT').length,
      visitorsInside: visitors.length,
      suspiciousToday: suspicious,
      sensorsOnline: sensors.length,
      sensorsTotal: sensors.length,
      accessEventsToday: secToday,
    },
    zoneStatus,
    alertSeverity,
    repairStatus,
    recent,
  })
}
