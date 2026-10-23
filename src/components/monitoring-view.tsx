'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useLiveStore } from '@/lib/live-store'
import { useUserStore } from '@/lib/user-store'
import { can } from '@/lib/permissions'
import type { Sensor, SensorReading } from '@/lib/types'
import { Pill, SEVERITY_STYLES, SimBadge, relTime, timeStr } from '@/components/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts'
import {
  Activity, Droplet, Droplets, Flame, Gauge, Thermometer, Wind, AirVent, Settings2, Wifi,
} from 'lucide-react'

const TYPE_META: Record<string, { icon: React.ReactNode; color: string }> = {
  TEMPERATURE: { icon: <Thermometer className="h-4 w-4" />, color: '#f59e0b' },
  SMOKE: { icon: <Flame className="h-4 w-4" />, color: '#ef4444' },
  GAS: { icon: <Wind className="h-4 w-4" />, color: '#a855f7' },
  WATER_LEVEL: { icon: <Droplets className="h-4 w-4" />, color: '#38bdf8' },
  POWER_LOAD: { icon: <Gauge className="h-4 w-4" />, color: '#f97316' },
  AIR_QUALITY: { icon: <AirVent className="h-4 w-4" />, color: '#14b8a6' },
  VIBRATION: { icon: <Activity className="h-4 w-4" />, color: '#8b5cf6' },
  HUMIDITY: { icon: <Droplet className="h-4 w-4" />, color: '#06b6d4' },
}

function ThresholdBar({ sensor, value }: { sensor: Sensor; value: number | null }) {
  const v = value ?? sensor.lastValue ?? sensor.baseline
  const span = sensor.maxThreshold - sensor.minThreshold
  const lo = sensor.minThreshold - span * 0.25
  const hi = sensor.maxThreshold + span * 0.25
  const pct = Math.min(Math.max(((v - lo) / (hi - lo)) * 100, 0), 100)
  const safeLo = ((sensor.minThreshold - lo) / (hi - lo)) * 100
  const safeHi = ((sensor.maxThreshold - lo) / (hi - lo)) * 100
  const out = v < sensor.minThreshold || v > sensor.maxThreshold
  return (
    <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="absolute inset-y-0 bg-emerald-500/25"
        style={{ left: `${safeLo}%`, width: `${safeHi - safeLo}%` }}
      />
      <div
        className={cn('absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full', out ? 'bg-red-500' : 'bg-emerald-500')}
        style={{ left: `calc(${pct}% - 2px)` }}
      />
    </div>
  )
}

export function MonitoringView() {
  const liveReadings = useLiveStore((s) => s.readings)
  const user = useUserStore((s) => s.user)
  const queryClient = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data: sensorsData } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => api<{ sensors: Sensor[] }>('/api/sensors'),
    refetchInterval: 20000,
  })
  const sensors = sensorsData?.sensors ?? []
  const detailSensor = sensors.find((s) => s.id === detailId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <Wifi className="h-4 w-4 text-emerald-500" />
        <p className="text-xs text-muted-foreground flex-1 min-w-0">
          Sensor telemetry active across ESP32-class sensor network. Values outside configured safe limits raise alerts to authorized responders automatically.
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Grid Armed
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sensors.map((s) => {
          const live = liveReadings[s.id]
          const value = live?.value ?? s.lastValue
          const severity = live?.severity ?? (s.lastStatus as 'NORMAL' | 'WARNING' | 'CRITICAL') ?? 'NORMAL'
          const meta = TYPE_META[s.type] ?? TYPE_META.TEMPERATURE
          return (
            <button
              key={s.id}
              onClick={() => setDetailId(s.id)}
              className={cn(
                'text-left rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-emerald-500/40',
                severity === 'CRITICAL' && 'border-red-500/50 ring-1 ring-red-500/30',
                severity === 'WARNING' && 'border-amber-500/50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="rounded-lg p-2" style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}>
                    {meta.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.zone} · {s.location}</p>
                  </div>
                </div>
                <Pill label={severity} className={SEVERITY_STYLES[severity]} />
              </div>

              <div className="mt-3 flex items-baseline gap-1.5">
                <span className={cn(
                  'text-3xl font-bold tabular-nums tracking-tight',
                  severity === 'CRITICAL' && 'text-red-500',
                  severity === 'WARNING' && 'text-amber-500',
                )}>
                  {value ?? '—'}
                </span>
                <span className="text-sm text-muted-foreground">{s.unit}</span>
                {live && <span className="ml-auto flex h-2 w-2"><span className="absolute h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="h-2 w-2 rounded-full bg-emerald-500" /></span>}
              </div>

              <div className="mt-3">
                <ThresholdBar sensor={s} value={value ?? null} />
                <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                  <span>min {s.minThreshold}{s.unit}</span>
                  <span>max {s.maxThreshold}{s.unit}</span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {s.code} · updated {live ? relTime(live.ts) : relTime(s.updatedAt)}
              </p>
            </button>
          )
        })}
        {sensors.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Loading sensors…</p>
        )}
      </div>

      <SensorDetailDialog sensor={detailSensor} onClose={() => setDetailId(null)} canConfigure={!!user && can.configureThresholds(user.role)} onSaved={() => queryClient.invalidateQueries({ queryKey: ['sensors'] })} />
    </div>
  )
}

function SensorDetailDialog({
  sensor, onClose, canConfigure, onSaved,
}: {
  sensor: Sensor | null
  onClose: () => void
  canConfigure: boolean
  onSaved: () => void
}) {
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: readingsData } = useQuery({
    queryKey: ['sensor-readings', sensor?.id],
    queryFn: () => api<{ readings: SensorReading[] }>(`/api/sensors/${sensor?.id}/readings?minutes=180`),
    enabled: !!sensor,
    refetchInterval: 10000,
  })

  const chartData = (readingsData?.readings ?? []).map((r) => ({
    t: timeStr(r.createdAt),
    value: r.value,
    anomaly: r.isAnomaly,
  }))

  const anomalies = (readingsData?.readings ?? []).filter((r) => r.isAnomaly).slice(-6).reverse()

  const saveThresholds = async () => {
    if (!sensor) return
    setSaving(true)
    try {
      await api(`/api/sensors/${sensor.id}/threshold`, {
        method: 'POST',
        json: { minThreshold: min === '' ? undefined : Number(min), maxThreshold: max === '' ? undefined : Number(max) },
      })
      toast.success('Alert limits updated — simulation picks them up within 5 minutes (or on service refresh)')
      onSaved()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!sensor} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {sensor && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {sensor.name}
                <span className="text-xs font-normal text-muted-foreground">{sensor.code}</span>
              </DialogTitle>
              <DialogDescription>
                {sensor.zone} · {sensor.location} — safe range {sensor.minThreshold}–{sensor.maxThreshold} {sensor.unit}
              </DialogDescription>
            </DialogHeader>

            <div className="h-[220px] rounded-lg border p-2">
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} minTickGap={50} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <ReferenceArea y1={sensor.minThreshold} y2={sensor.maxThreshold} fill="#10b981" fillOpacity={0.08} strokeOpacity={0} />
                    <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading history…</div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Shaded band = configured safe range. Readings outside it trigger alerts (visible in the alert center).
            </p>

            {anomalies.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1.5">Recent unusual readings</p>
                <div className="space-y-1">
                  {anomalies.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-md border bg-red-500/5 px-2.5 py-1.5 text-xs">
                      <span className="font-semibold text-red-500 tabular-nums">{a.value} {sensor.unit}</span>
                      <span className="text-muted-foreground">outside {sensor.minThreshold}–{sensor.maxThreshold}</span>
                      <span className="ml-auto text-muted-foreground">{relTime(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canConfigure && (
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold mb-2">
                  <Settings2 className="h-3.5 w-3.5" /> Configure alert limits (Administrator)
                </p>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="min-th" className="text-[11px] text-muted-foreground">Lower limit ({sensor.unit})</Label>
                    <Input id="min-th" type="number" step="0.1" placeholder={String(sensor.minThreshold)} value={min} onChange={(e) => setMin(e.target.value)} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="max-th" className="text-[11px] text-muted-foreground">Upper limit ({sensor.unit})</Label>
                    <Input id="max-th" type="number" step="0.1" placeholder={String(sensor.maxThreshold)} value={max} onChange={(e) => setMax(e.target.value)} />
                  </div>
                  <Button onClick={saveThresholds} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Once saved, the simulation service applies the new limits and future alerts follow them.
                </p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
