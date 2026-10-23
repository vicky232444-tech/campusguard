'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useLiveStore } from '@/lib/live-store'
import type { DashboardData, Sensor, SensorReading } from '@/lib/types'
import { StatCard, Pill, SEVERITY_STYLES, relTime, SimBadge, timeStr } from '@/components/shared'
import { cn } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  AlertTriangle, Building2, DoorOpen, Siren, Users, Wrench, Activity, ShieldAlert,
} from 'lucide-react'

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

export function DashboardView() {
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

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active alerts" value={stats?.activeAlerts ?? '—'} icon={<AlertTriangle className="h-4 w-4" />} tone={stats && stats.activeAlerts > 0 ? 'warning' : 'success'} sub="across all zones" />
        <StatCard label="Active SOS" value={stats?.activeSos ?? '—'} icon={<Siren className="h-4 w-4" />} tone={stats && stats.activeSos > 0 ? 'danger' : 'success'} sub="emergency alerts" />
        <StatCard label="Open repairs" value={stats?.openRepairs ?? '—'} icon={<Wrench className="h-4 w-4" />} tone={stats && stats.urgentRepairs > 0 ? 'danger' : 'info'} sub={stats && stats.urgentRepairs > 0 ? `${stats.urgentRepairs} urgent` : 'none urgent'} />
        <StatCard label="Visitors inside" value={stats?.visitorsInside ?? '—'} icon={<Users className="h-4 w-4" />} tone="neutral" sub="checked in now" />
        <StatCard label="Suspicious (24h)" value={stats?.suspiciousToday ?? '—'} icon={<ShieldAlert className="h-4 w-4" />} tone={stats && stats.suspiciousToday > 0 ? 'warning' : 'success'} sub={`${stats?.accessEventsToday ?? 0} access events`} />
        <StatCard label="Sensors online" value={stats ? `${stats.sensorsOnline}/${stats.sensorsTotal}` : '—'} icon={<Activity className="h-4 w-4" />} tone="success" sub="active telemetry grid" />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-xl border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Sensor Telemetry Trend — 2 Hours</h3>
              <p className="text-xs text-muted-foreground">{selectedSensor ? `${selectedSensor.name} · ${selectedSensor.zone} (${selectedSensor.unit})` : 'Loading…'}</p>
            </div>
            <select
              aria-label="Select sensor"
              value={selectedId ?? ''}
              onChange={(e) => setChartSensorId(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              {sensors.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>
          <div className="h-[240px]">
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
            <SimBadge /> red dots = readings outside configured safe range
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold mb-1">Alerts by severity (24 h)</h3>
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

          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold mb-1">Repair requests</h3>
            <div className="h-[130px]">
              {dash && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dash.repairStatus} dataKey="count" nameKey="status" innerRadius={34} outerRadius={52} paddingAngle={3} strokeWidth={0}>
                      {dash.repairStatus.map((entry) => (
                        <Cell key={entry.status} fill={entry.status === 'PENDING' ? '#f59e0b' : entry.status === 'IN_PROGRESS' ? '#38bdf8' : '#10b981'} />
                      ))}
                    </Pie>
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => v.replaceAll('_', ' ')} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Zones + feed */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" /> Zone status
          </h3>
          <div className="space-y-2">
            {dash?.zoneStatus.map((z) => (
              <div key={z.zone} className={cn('rounded-lg border p-2.5 flex items-center gap-3', ZONE_TONE[z.status])}>
                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', ZONE_DOT[z.status])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{z.zone}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {z.totalSensors} sensors · {z.activeAlerts} alerts · {z.openRepairs} open repairs
                    {z.abnormalSensors > 0 ? ` · ${z.abnormalSensors} abnormal` : ''}
                  </p>
                </div>
                <Pill label={z.status} className={SEVERITY_STYLES[z.status]} />
              </div>
            ))}
            {!dash && <p className="text-sm text-muted-foreground py-4 text-center">Loading zones…</p>}
          </div>
        </div>

        <div className="lg:col-span-3 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-muted-foreground" /> Live activity feed
          </h3>
          <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2 [scrollbar-width:thin]">
            {dash?.recent.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="flex gap-3 rounded-lg border p-2.5">
                <div className={cn(
                  'mt-0.5 rounded-md p-1.5',
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
            {!dash && <p className="text-sm text-muted-foreground py-4 text-center">Loading feed…</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
