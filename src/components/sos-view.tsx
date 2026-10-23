'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { can } from '@/lib/permissions'
import type { SosAlert } from '@/lib/types'
import { ZONES } from '@/lib/types'
import { Pill, SEVERITY_STYLES, dateTimeStr, relTime } from '@/components/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CarFront, Check, CheckCheck, HeartPulse, Flame, MapPin, MessageSquareLock, Siren, TriangleAlert, ShieldAlert,
} from 'lucide-react'

const EMERGENCY_TYPES = [
  { id: 'MEDICAL', label: 'Medical', icon: <HeartPulse className="h-5 w-5" /> },
  { id: 'FIRE', label: 'Fire', icon: <Flame className="h-5 w-5" /> },
  { id: 'SECURITY_THREAT', label: 'Security threat', icon: <ShieldAlert className="h-5 w-5" /> },
  { id: 'ACCIDENT', label: 'Accident', icon: <CarFront className="h-5 w-5" /> },
  { id: 'OTHER', label: 'Other', icon: <TriangleAlert className="h-5 w-5" /> },
] as const

function HoldButton({ onTriggered, disabled }: { onTriggered: () => void; disabled: boolean }) {
  const [progress, setProgress] = useState(0)
  const holding = useRef(false)
  const raf = useRef<number | null>(null)
  const start = useRef(0)
  const HOLD_MS = 1500

  const stop = (completed: boolean) => {
    holding.current = false
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    if (completed) {
      setProgress(1)
      onTriggered()
      setTimeout(() => setProgress(0), 800)
    } else {
      setProgress(0)
    }
  }

  const tick = () => {
    if (!holding.current) return
    const p = Math.min((Date.now() - start.current) / HOLD_MS, 1)
    setProgress(p)
    if (p >= 1) { stop(true); return }
    raf.current = requestAnimationFrame(tick)
  }

  const down = () => {
    if (disabled || holding.current) return
    holding.current = true
    start.current = Date.now()
    raf.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current) }, [])

  const R = 56
  const CIRC = 2 * Math.PI * R

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        aria-label="Hold to trigger SOS"
        disabled={disabled}
        onPointerDown={down}
        onPointerUp={() => stop(false)}
        onPointerLeave={() => stop(false)}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          'relative flex h-36 w-36 select-none items-center justify-center rounded-full text-white shadow-lg transition-transform',
          'bg-gradient-to-b from-red-500 to-red-600 disabled:opacity-50 active:scale-[0.97]',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/40',
        )}
      >
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
          <circle
            cx="64" cy="64" r={R} fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)}
          />
        </svg>
        <div className="flex flex-col items-center">
          <Siren className="h-8 w-8" />
          <span className="mt-1 text-sm font-bold tracking-wide">{progress > 0 ? 'KEEP HOLDING' : 'HOLD FOR SOS'}</span>
          <span className="text-[10px] opacity-80">1.5 s hold · prevents false alarms</span>
        </div>
      </button>
    </div>
  )
}

export function SosView() {
  const user = useUserStore((s) => s.user)
  const queryClient = useQueryClient()
  const [type, setType] = useState<string>('MEDICAL')
  const [message, setMessage] = useState('')
  const [zone, setZone] = useState<string>('')
  const [shareLoc, setShareLoc] = useState(true)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locState, setLocState] = useState<'idle' | 'locating' | 'ok' | 'denied'>('idle')
  const [triggering, setTriggering] = useState(false)

  const isResponder = !!user && can.ackSos(user.role)

  const { data: sosData } = useQuery({
    queryKey: ['sos'],
    queryFn: () => api<{ sos: SosAlert[] }>('/api/sos'),
    refetchInterval: 10000,
  })
  const sos = sosData?.sos ?? []
  const active = sos.filter((s) => s.status !== 'RESOLVED')
  const history = sos.filter((s) => s.status === 'RESOLVED')

  // Resolve coordinates when the privacy toggle is turned on
  useEffect(() => {
    if (!shareLoc || typeof navigator === 'undefined' || !navigator.geolocation) return
    setLocState('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocState('ok')
      },
      () => {
        setCoords(null)
        setLocState('denied')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }, [shareLoc])

  const trigger = async () => {
    setTriggering(true)
    try {
      let lat: number | null = null
      let lng: number | null = null
      if (shareLoc) {
        const pos = coords
          ? { lat: coords.lat, lng: coords.lng }
          : await new Promise<{ lat: number; lng: number } | null>((resolve) => {
            if (!navigator.geolocation) return resolve(null)
            navigator.geolocation.getCurrentPosition(
              (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
              () => resolve(null),
              { timeout: 6000, maximumAge: 30000 },
            )
            setTimeout(() => resolve(null), 7000)
          })
        if (pos) { lat = pos.lat; lng = pos.lng }
      }

      const { sos: created } = await api<{ sos: SosAlert }>('/api/sos', {
        method: 'POST',
        json: {
          emergencyType: type,
          message: message.trim() || undefined,
          shareLocation: shareLoc,
          latitude: lat,
          longitude: lng,
          locationText: zone || undefined,
        },
      })
      toast.success('SOS triggered — responders notified', {
        description: shareLoc && lat ? `Location shared (${lat.toFixed(4)}, ${lng?.toFixed(4)})` : 'Location not shared (privacy setting)',
      })
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['sos'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void created
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTriggering(false)
    }
  }

  const act = async (id: string, action: 'ack' | 'resolve') => {
    try {
      await api(`/api/sos/${id}`, { method: 'POST', json: { action } })
      toast.success(action === 'ack' ? 'SOS acknowledged — help on the way' : 'SOS resolved')
      queryClient.invalidateQueries({ queryKey: ['sos'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Trigger panel */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Siren className="h-4 w-4 text-red-500" /> Trigger emergency alert
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Notifies security staff, maintenance responders and administrators instantly with an audible alarm.
          </p>

          <div className="mt-4">
            <Label className="text-xs text-muted-foreground">Emergency type</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {EMERGENCY_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors',
                    type === t.id
                      ? 'border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold'
                      : 'text-muted-foreground hover:border-red-500/30 hover:bg-red-500/5',
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Where are you? (zone)</Label>
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger><SelectValue placeholder="Select building / zone" /></SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sos-msg" className="text-xs text-muted-foreground">Message (optional)</Label>
              <Textarea id="sos-msg" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Short description for responders…" />
            </div>

            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium">Share live location</p>
                    <p className="text-[11px] text-muted-foreground">
                      {locState === 'ok' && coords
                        ? `GPS ready — ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                        : locState === 'denied'
                          ? 'Browser permission denied — SOS will be sent without coordinates'
                          : locState === 'locating'
                            ? 'Requesting browser location permission…'
                            : 'Uses the browser Geolocation API with your consent'}
                    </p>
                  </div>
                </div>
                <Switch checked={shareLoc} onCheckedChange={setShareLoc} aria-label="Share live location" />
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[10px] text-muted-foreground">
                <MessageSquareLock className="h-3 w-3 shrink-0 mt-0.5" />
                Privacy: location is shared only with this SOS and never stored for other purposes. Surveillance zones are monitored, not recorded.
              </p>
            </div>

            <HoldButton onTriggered={() => { if (!triggering) void trigger() }} disabled={triggering} />
            <p className="text-center text-[11px] text-muted-foreground">
              {triggering ? 'Sending SOS…' : 'Press and hold the button for 1.5 seconds'}
            </p>
          </div>
        </div>
      </div>

      {/* Responders / status */}
      <div className="lg:col-span-3 space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Siren className="h-4 w-4 text-red-500" />
            Active SOS alerts
            {active.length > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{active.length}</span>}
          </h3>
          <div className="mt-3 space-y-2.5">
            {active.length === 0 && (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center text-sm text-emerald-600 dark:text-emerald-400">
                No active emergencies — all clear.
              </p>
            )}
            {active.map((s) => (
              <div key={s.id} className={cn(
                'rounded-lg border p-3.5',
                s.status === 'ACTIVE' ? 'border-red-500/40 bg-red-500/5' : 'border-amber-500/40 bg-amber-500/5',
              )}>
                <div className="flex flex-wrap items-center gap-2">
                  <Siren className={cn('h-4 w-4', s.status === 'ACTIVE' ? 'text-red-500 animate-pulse' : 'text-amber-500')} />
                  <p className="text-sm font-bold">{s.emergencyType.replaceAll('_', ' ')}</p>
                  <Pill label={s.status} className={SEVERITY_STYLES[s.status]} />
                  <span className="ml-auto text-[11px] text-muted-foreground">{relTime(s.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  <strong className="text-foreground/80">{s.triggeredBy}</strong> ({s.role.toLowerCase()}){s.locationText ? ` · ${s.locationText}` : ''}
                </p>
                {s.message && <p className="mt-1 text-xs">&ldquo;{s.message}&rdquo;</p>}
                {s.shareLocation && s.latitude != null && (
                  <a
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
                    href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                    target="_blank" rel="noreferrer"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Live location: {s.latitude.toFixed(5)}, {s.longitude?.toFixed(5)} — open map
                  </a>
                )}
                {s.status !== 'RESOLVED' && isResponder && (
                  <div className="mt-3 flex gap-2">
                    {s.status === 'ACTIVE' && can.ackSos(user!.role) && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400" onClick={() => act(s.id, 'ack')}>
                        <Check className="h-3 w-3" /> Acknowledge
                      </Button>
                    )}
                    {can.resolveSos(user!.role) && (
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => act(s.id, 'resolve')}>
                        <CheckCheck className="h-3 w-3" /> Mark resolved
                      </Button>
                    )}
                  </div>
                )}
                {s.status === 'ACKNOWLEDGED' && s.acknowledgedBy && (
                  <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">Acknowledged by {s.acknowledgedBy} — responders en route.</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">SOS history</h3>
          <div className="mt-3 space-y-2">
            {history.length === 0 && <p className="text-xs text-muted-foreground py-3 text-center">No resolved SOS alerts yet.</p>}
            {history.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                <span className="font-semibold">{s.emergencyType.replaceAll('_', ' ')}</span>
                <span className="text-muted-foreground">{s.triggeredBy} · {s.locationText ?? 'zone not set'}</span>
                <Pill label="RESOLVED" className={SEVERITY_STYLES.RESOLVED} />
                <span className="ml-auto text-muted-foreground">{dateTimeStr(s.createdAt)}{s.resolvedBy ? ` · closed by ${s.resolvedBy}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
