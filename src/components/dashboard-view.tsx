'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { useLiveStore } from '@/lib/live-store'
import type { DashboardData, Sensor, SensorReading, SosBroadcastRequest, MaintenanceReport, StudentVerification, VisitorLog, SecurityEvent } from '@/lib/types'
import { StatCard, Pill, SEVERITY_STYLES, STATUS_STYLES, relTime, timeStr } from '@/components/shared'
import { cn } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  AlertTriangle, Building2, DoorOpen, Siren, Users, Wrench, Activity, ShieldAlert,
  ShieldCheck, Check, X, Clock, FileText, CheckCircle2, UserCheck, Sparkles, MapPin,
  Flame, PhoneCall, ChevronRight, HardHat, Camera, Radio, AlertOctagon, HelpCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const ZONE_TONE: Record<string, string> = {
  NORMAL: 'border-emerald-500/40 bg-emerald-500/5',
  ATTENTION: 'border-amber-500/40 bg-amber-500/5',
  CRITICAL: 'border-red-500/40 bg-red-500/5',
}
const ZONE_DOT: Record<string, string> = {
  NORMAL: 'bg-emerald-500',
  ATTENTION: 'bg-amber-500',
  CRITICAL: 'bg-red-500 animate-pulse',
}

const FEED_ICON: Record<string, React.ReactNode> = {
  alert: <AlertTriangle className="h-4 w-4" />,
  sos: <Siren className="h-4 w-4" />,
  security: <ShieldAlert className="h-4 w-4" />,
  maintenance: <Wrench className="h-4 w-4" />,
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ADMIN DASHBOARD: High-Authority Command & Control Center
// ─────────────────────────────────────────────────────────────────────────────
function AdminDashboard() {
  const queryClient = useQueryClient()
  const liveReadings = useLiveStore((s) => s.readings)
  const [chartSensorId, setChartSensorId] = useState<string | null>(null)

  const { data: dash } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/api/dashboard'),
    refetchInterval: 10000,
  })

  const { data: sensorsData } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => api<{ sensors: Sensor[] }>('/api/sensors'),
  })
  const sensors = sensorsData?.sensors ?? []
  const selectedId = chartSensorId ?? sensors[0]?.id ?? null

  const { data: readingsData } = useQuery({
    queryKey: ['sensor-readings', selectedId],
    queryFn: () => api<{ readings: SensorReading[] }>(`/api/sensors/${selectedId}/readings?minutes=120`),
    enabled: !!selectedId,
    refetchInterval: 30000,
  })

  // Pending SOS broadcast requests submitted by regular users
  const { data: reqData } = useQuery({
    queryKey: ['sos-requests'],
    queryFn: () => api<{ requests: SosBroadcastRequest[] }>('/api/sos/requests'),
    refetchInterval: 5000,
  })
  const requests = reqData?.requests ?? []
  const pendingRequests = requests.filter((r) => r.status === 'PENDING')

  // Student verification stats
  const { data: verifData } = useQuery({
    queryKey: ['student-verifications'],
    queryFn: () => api<{ records: StudentVerification[] }>('/api/students/verification'),
    refetchInterval: 15000,
  })
  const studentRecords = verifData?.records ?? []
  const pendingVerifications = studentRecords.filter((s) => s.status === 'PENDING')

  const chartData = useMemo(() => {
    if (!readingsData || !selectedId) return []
    const sensor = sensors.find((s) => s.id === selectedId)
    const points = readingsData.readings.map((r) => ({
      t: timeStr(r.createdAt),
      value: r.value,
      anomaly: r.isAnomaly,
    }))
    const live = liveReadings[selectedId]
    if (live && sensor) points.push({ t: timeStr(live.ts), value: live.value, anomaly: live.isAnomaly })
    return points
  }, [readingsData, selectedId, liveReadings, sensors])

  const selectedSensor = sensors.find((s) => s.id === selectedId)
  const stats = dash?.stats

  const handleApproveRequest = async (id: string) => {
    try {
      await api(`/api/sos/requests/${id}/approve`, { method: 'POST' })
      toast.success('Approved! Campus-wide SOS evacuation broadcast triggered on all devices.')
      queryClient.invalidateQueries({ queryKey: ['sos-requests'] })
      queryClient.invalidateQueries({ queryKey: ['sos'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleRejectRequest = async (id: string) => {
    try {
      await api(`/api/sos/requests/${id}/reject`, { method: 'POST', json: { reason: 'Declined by Administrator after verification.' } })
      toast.info('SOS request declined.')
      queryClient.invalidateQueries({ queryKey: ['sos-requests'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      {/* Pending SOS Permission Requests Action Banner (Crucial Requirement) */}
      {pendingRequests.length > 0 && (
        <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4 shadow-lg space-y-3 siren-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Siren className="h-5 w-5 text-red-500 animate-spin" />
              <div>
                <h3 className="text-sm font-black text-red-600 dark:text-red-400">
                  {pendingRequests.length} Pending All-Devices SOS Broadcast Request{pendingRequests.length > 1 ? 's' : ''}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Regular users cannot broadcast to all devices directly. Your administrative authorization is required.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
              Action Required
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-red-500/20">
            {pendingRequests.map((req) => (
              <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/80 p-3 border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{req.requestedByName}</span>
                    <span className="text-[11px] text-muted-foreground">({req.requestedRole})</span>
                    <span className="text-[11px] font-semibold text-red-500">· {req.emergencyType.replaceAll('_', ' ')}</span>
                    <span className="text-[11px] text-muted-foreground">· {req.zone}</span>
                  </div>
                  <p className="text-xs italic text-foreground/90 mt-0.5">&ldquo;{req.reason}&rdquo;</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Requested {relTime(req.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5 shadow"
                    onClick={() => handleApproveRequest(req.id)}
                  >
                    <Siren className="h-3.5 w-3.5" /> Approve &amp; Trigger All Devices
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-slate-500/30 text-muted-foreground hover:text-red-600"
                    onClick={() => handleRejectRequest(req.id)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin KPI Ribbon */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active alerts" value={stats?.activeAlerts ?? '—'} icon={<AlertTriangle className="h-4 w-4" />} tone={stats && stats.activeAlerts > 0 ? 'warning' : 'success'} sub="all zones" />
        <StatCard label="Active SOS" value={stats?.activeSos ?? '—'} icon={<Siren className="h-4 w-4" />} tone={stats && stats.activeSos > 0 ? 'danger' : 'success'} sub={pendingRequests.length > 0 ? `${pendingRequests.length} pending approval` : 'all clear'} />
        <StatCard label="Student Records" value={studentRecords.length} icon={<UserCheck className="h-4 w-4" />} tone={pendingVerifications.length > 0 ? 'warning' : 'success'} sub={`${pendingVerifications.length} pending AI verify`} />
        <StatCard label="Open repairs" value={stats?.openRepairs ?? '—'} icon={<Wrench className="h-4 w-4" />} tone={stats && stats.urgentRepairs > 0 ? 'danger' : 'info'} sub={stats && stats.urgentRepairs > 0 ? `${stats.urgentRepairs} urgent` : 'none urgent'} />
        <StatCard label="Visitors inside" value={stats?.visitorsInside ?? '—'} icon={<Users className="h-4 w-4" />} tone="neutral" sub="checked in now" />
        <StatCard label="Sensors online" value={stats ? `${stats.sensorsOnline}/${stats.sensorsTotal}` : '—'} icon={<Activity className="h-4 w-4" />} tone="success" sub="active grid" />
      </div>

      {/* Admin Telemetry Trends + Severity Charts */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" /> Sensor Telemetry Trend — 2 Hours
              </h3>
              <p className="text-xs text-muted-foreground">{selectedSensor ? `${selectedSensor.name} · ${selectedSensor.zone} (${selectedSensor.unit})` : 'Loading…'}</p>
            </div>
            <select
              aria-label="Select sensor"
              value={selectedId ?? ''}
              onChange={(e) => setChartSensorId(e.target.value)}
              className="h-8 rounded-lg border bg-background px-2 text-xs"
            >
              {sensors.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>
          <div className="h-[230px]">
            {chartData.length > 1 && selectedSensor ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="sensorFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={40} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#sensorFill)" isAnimationActive={false} dot={(p) => {
                    if (!p.payload.anomaly) return <g key={p.key} />
                    return <circle key={p.key} cx={p.cx} cy={p.cy} r={3.5} fill="#ef4444" />
                  }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading trend…</div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
            Red markers indicate telemetry values exceeding safe threshold limits
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-bold mb-1">Alerts by Severity (24h)</h3>
            <div className="h-[120px]">
              {dash && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dash.alertSeverity} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                    <XAxis dataKey="severity" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {dash.alertSeverity.map((entry) => (
                        <Cell key={entry.severity} fill={entry.severity === 'CRITICAL' ? '#ef4444' : entry.severity === 'HIGH' ? '#f97316' : entry.severity === 'MEDIUM' ? '#f59e0b' : '#38bdf8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-bold mb-1">Repair Pipeline Status</h3>
            <div className="h-[120px]">
              {dash && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dash.repairStatus} dataKey="count" nameKey="status" innerRadius={30} outerRadius={48} paddingAngle={3} strokeWidth={0}>
                      {dash.repairStatus.map((entry) => (
                        <Cell key={entry.status} fill={entry.status === 'PENDING' ? '#f59e0b' : entry.status === 'IN_PROGRESS' ? '#38bdf8' : '#10b981'} />
                      ))}
                    </Pie>
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} formatter={(v: string) => v.replaceAll('_', ' ')} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Campus Zones & Activity Log */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2 rounded-2xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-500" /> Campus Zones Status
          </h3>
          <div className="space-y-2">
            {dash?.zoneStatus.map((z) => (
              <div key={z.zone} className={cn('rounded-xl border p-2.5 flex items-center gap-3', ZONE_TONE[z.status])}>
                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', ZONE_DOT[z.status])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{z.zone}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {z.totalSensors} sensors · {z.activeAlerts} alerts · {z.openRepairs} repairs
                  </p>
                </div>
                <Pill label={z.status} className={SEVERITY_STYLES[z.status]} />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 rounded-2xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-emerald-500" /> Campus Operations Feed
          </h3>
          <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2 [scrollbar-width:thin]">
            {dash?.recent.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="flex gap-3 rounded-xl border p-2.5 bg-background/50">
                <div className={cn(
                  'mt-0.5 rounded-lg p-1.5',
                  item.kind === 'sos' ? 'bg-red-500/10 text-red-500'
                    : item.kind === 'alert' ? 'bg-amber-500/10 text-amber-500'
                      : item.kind === 'security' ? 'bg-purple-500/10 text-purple-500'
                        : 'bg-sky-500/10 text-sky-500',
                )}>
                  {FEED_ICON[item.kind]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium leading-tight">{item.title}</p>
                    <Pill label={item.severity} className={SEVERITY_STYLES[item.severity]} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{relTime(item.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. STUDENT DASHBOARD: Tailored Specifically for Student Safety & Services
// ─────────────────────────────────────────────────────────────────────────────
function StudentDashboard() {
  const user = useUserStore((s) => s.user)

  // Fetch student's own complaints
  const { data: repData } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => api<{ reports: MaintenanceReport[] }>('/api/maintenance'),
  })
  const myReports = (repData?.reports ?? []).filter((r) => r.reportedById === user?.id || r.reportedBy === user?.name)

  // Fetch student verification record
  const { data: verifData } = useQuery({
    queryKey: ['student-verifications'],
    queryFn: () => api<{ records: StudentVerification[] }>('/api/students/verification'),
  })
  const myRecord = verifData?.records?.[0]

  return (
    <div className="space-y-6">
      {/* Student Top Welcome & Digital Identity Card */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Digital Student Card with AI Verification Badge */}
        <div className="md:col-span-2 rounded-2xl border bg-gradient-to-br from-card via-card to-emerald-500/5 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black text-white shadow-md"
                style={{ backgroundColor: user?.color || '#10b981' }}
              >
                {user?.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">{user?.name}</h2>
                <p className="text-xs text-muted-foreground font-medium">{user?.dept || 'Computer Science & Engineering'}</p>
                <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ID: {myRecord?.rollNumber || 'CS-2024-0419'} · {user?.email}
                </p>
              </div>
            </div>

            {/* AI Verification Badge */}
            <div className="flex flex-col items-end">
              {myRecord?.status === 'VERIFIED' ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-sm">
                  <ShieldCheck className="h-4 w-4" />
                  AI Verified Student
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                  Verification Pending
                </div>
              )}
              {myRecord?.aiConfidenceScore && (
                <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-emerald-500" />
                  {myRecord.aiConfidenceScore}% AI Authenticity
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t text-xs">
            <div className="rounded-xl bg-muted/40 p-2.5">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Hostel Room</span>
              <span className="font-semibold text-foreground">{myRecord?.hostelRoom || 'Hostel Block B - Room 204'}</span>
            </div>
            <div className="rounded-xl bg-muted/40 p-2.5">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Enrolled Year</span>
              <span className="font-semibold text-foreground">{myRecord?.yearOfStudy || '1st Year (2024-28)'}</span>
            </div>
            <div className="rounded-xl bg-muted/40 p-2.5 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Campus Status</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Active Enrolled
              </span>
            </div>
          </div>
        </div>

        {/* Student Quick Safety Action Widget */}
        <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-card via-card to-red-500/10 p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <Siren className="h-4 w-4" />
                Emergency Safety Hub
              </span>
              <span className="text-[10px] font-bold bg-red-500/20 text-red-600 px-2 py-0.5 rounded-full">
                Free Will SOS
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              In danger or witnessing a crisis? Trigger your personal distress SOS anytime.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <a
              href="#sos"
              onClick={(e) => {
                e.preventDefault()
                // Navigate to SOS tab via custom event or user interaction
                window.location.hash = 'sos'
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 text-xs font-bold shadow-md transition-all active:scale-[0.98]"
            >
              <Siren className="h-4 w-4" /> Go to Emergency SOS
            </a>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <span>Security Helpline:</span>
              <a href="tel:1800226787" className="font-bold text-foreground hover:underline">1800-226-787</a>
            </div>
          </div>
        </div>
      </div>

      {/* Student Complaints & Issues Tracker */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-emerald-500" /> My Registered Campus Complaints
            </h3>
            <p className="text-xs text-muted-foreground">
              Real-time progress on hostel, classroom and campus issues you reported.
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
            {myReports.length} {myReports.length === 1 ? 'Report' : 'Reports'}
          </span>
        </div>

        {myReports.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold">No active issues reported</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Everything in your hostel and classrooms is operating smoothly. If something breaks, report it via the Maintenance tab.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {myReports.map((report) => (
              <div key={report.id} className="rounded-xl border p-3.5 space-y-2 bg-muted/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">{report.code}</span>
                    <span className="text-sm font-bold text-foreground">{report.title}</span>
                  </div>
                  <Pill label={report.status} className={STATUS_STYLES[report.status]} />
                </div>
                <p className="text-xs text-muted-foreground">{report.description}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-[11px] text-muted-foreground">
                  <span>Zone: <b>{report.zone}</b></span>
                  <span>Category: <b>{report.category}</b></span>
                  <span>Reported {relTime(report.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campus Emergency Directory & Assembly Points */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-emerald-500" /> Quick Emergency Directory
          </h3>
          <div className="divide-y text-xs">
            <div className="py-2 flex items-center justify-between">
              <div>
                <p className="font-bold">National Emergency Helpline</p>
                <p className="text-[11px] text-muted-foreground">All-in-one Police, Fire &amp; Ambulance</p>
              </div>
              <a href="tel:112" className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-600 font-bold">112</a>
            </div>
            <div className="py-2 flex items-center justify-between">
              <div>
                <p className="font-bold">Campus Security Main Gate</p>
                <p className="text-[11px] text-muted-foreground">Control Room 24x7</p>
              </div>
              <a href="tel:1800226787" className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-600 font-bold">1800-226-787</a>
            </div>
            <div className="py-2 flex items-center justify-between">
              <div>
                <p className="font-bold">Medical Center &amp; Ambulance</p>
                <p className="text-[11px] text-muted-foreground">On-Campus First Response</p>
              </div>
              <a href="tel:102" className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-600 font-bold">102</a>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-500" /> Designated Assembly Points
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="rounded-xl border p-2.5 bg-background">
              <p className="font-bold">Assembly Point 1 — Central Sports Ground</p>
              <p className="text-[11px] text-muted-foreground">For Academic Blocks A &amp; B and Library evacuation.</p>
            </div>
            <div className="rounded-xl border p-2.5 bg-background">
              <p className="font-bold">Assembly Point 2 — Hostel Quadrangle Lawns</p>
              <p className="text-[11px] text-muted-foreground">For all residential hostel blocks &amp; cafeteria.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TECHNICIAN / MAINTENANCE DASHBOARD: Task Queue, AI Tamper Proofs & Categories
// ─────────────────────────────────────────────────────────────────────────────
function TechnicianDashboard() {
  const { data: repData } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => api<{ reports: MaintenanceReport[] }>('/api/maintenance'),
    refetchInterval: 10000,
  })
  const reports = repData?.reports ?? []

  const pendingProof = reports.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'APPROVED')
  const inAiVerification = reports.filter((r) => r.status === 'PROOF_SUBMITTED' || r.status === 'AWAITING_ADMIN')
  const resolved = reports.filter((r) => r.status === 'RESOLVED')

  return (
    <div className="space-y-5">
      {/* Technician KPI Ribbons */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active Work Orders" value={pendingProof.length} icon={<HardHat className="h-4 w-4" />} tone={pendingProof.length > 0 ? 'warning' : 'success'} sub="assigned for repair" />
        <StatCard label="In AI Tamper Check" value={inAiVerification.length} icon={<Sparkles className="h-4 w-4" />} tone="info" sub="proof submitted" />
        <StatCard label="Resolved Repairs" value={resolved.length} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" sub="completed" />
        <StatCard label="Total Tracked" value={reports.length} icon={<Wrench className="h-4 w-4" />} tone="neutral" sub="across all campus" />
      </div>

      {/* Active Work Orders Table */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <HardHat className="h-4 w-4 text-emerald-500" /> Field Work Orders Requiring Action
            </h3>
            <p className="text-xs text-muted-foreground">
              Review assigned repairs and upload after-work camera photos for AI inspection.
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-bold">
            {pendingProof.length} Active
          </span>
        </div>

        {pendingProof.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No pending repairs awaiting work. All systems nominal.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingProof.map((item) => (
              <div key={item.id} className="rounded-xl border p-4 space-y-2 bg-background/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-600">{item.code}</span>
                    <span className="text-sm font-bold text-foreground">{item.title}</span>
                    <span className="text-xs text-muted-foreground">· Category: {item.category}</span>
                  </div>
                  <Pill label={item.priority} className={SEVERITY_STYLES[item.priority]} />
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
                  <span className="text-muted-foreground">Location: <b>{item.zone}</b></span>
                  <span className="text-muted-foreground">Reported by: <b>{item.reportedBy}</b></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SECURITY DASHBOARD: Gate Access, Visitors & Active SOS Beacons
// ─────────────────────────────────────────────────────────────────────────────
function SecurityDashboard() {
  const { data: dash } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/api/dashboard'),
  })
  const { data: visData } = useQuery({
    queryKey: ['visitors'],
    queryFn: () => api<{ visitors: VisitorLog[] }>('/api/security/visitors'),
  })
  const visitors = visData?.visitors ?? []
  const inside = visitors.filter((v) => v.status === 'INSIDE')

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Visitors Inside" value={inside.length} icon={<Users className="h-4 w-4" />} tone="info" sub="checked in right now" />
        <StatCard label="Active SOS Signals" value={dash?.stats.activeSos ?? 0} icon={<Siren className="h-4 w-4" />} tone={dash && dash.stats.activeSos > 0 ? 'danger' : 'success'} sub="security beacons" />
        <StatCard label="Security Incidents (24h)" value={dash?.stats.suspiciousToday ?? 0} icon={<ShieldAlert className="h-4 w-4" />} tone={dash && dash.stats.suspiciousToday > 0 ? 'warning' : 'success'} sub="access anomalies" />
        <StatCard label="Total Access Swipes" value={dash?.stats.accessEventsToday ?? 0} icon={<DoorOpen className="h-4 w-4" />} tone="neutral" sub="monitored gates" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Visitors Inside */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" /> Active Campus Visitors
            </h3>
            <span className="text-xs text-muted-foreground">{inside.length} inside</span>
          </div>
          {inside.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No external visitors currently on premises.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {inside.map((v) => (
                <div key={v.id} className="rounded-xl border p-2.5 flex items-center justify-between text-xs bg-muted/20">
                  <div>
                    <p className="font-bold">{v.visitorName}</p>
                    <p className="text-[11px] text-muted-foreground">Host: {v.hostName} · Pass: {v.passNo}</p>
                  </div>
                  <Pill label="INSIDE" className={STATUS_STYLES.INSIDE} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Quick Actions */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Perimeter &amp; Gate Protocols
          </h3>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl border bg-muted/30">
              <p className="font-bold">Rapid Visitor Check-In</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Use the Security tab for 1-click automatic visitor entry filling.</p>
            </div>
            <div className="p-3 rounded-xl border bg-muted/30">
              <p className="font-bold">SOS Distress Response</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Live GPS coordinates will route emergency officers directly to distress callers.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────
export function DashboardView() {
  const user = useUserStore((s) => s.user)

  if (!user) return null

  // Route to the role-specific dashboard
  if (user.role === 'ADMIN') {
    return <AdminDashboard />
  }
  if (user.role === 'STUDENT') {
    return <StudentDashboard />
  }
  if (user.role === 'MAINTENANCE') {
    return <TechnicianDashboard />
  }
  // Security view
  return <SecurityDashboard />
}
