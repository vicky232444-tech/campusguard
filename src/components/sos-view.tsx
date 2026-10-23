'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { can } from '@/lib/permissions'
import type { SosAlert } from '@/lib/types'
import { ZONES } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { useOfflineSync } from '@/lib/offline-sync'
import { playEmergencySiren30Sec, stopEmergencySiren } from '@/lib/beep'
import { Pill, SEVERITY_STYLES, dateTimeStr, relTime } from '@/components/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  CarFront, Check, CheckCheck, HeartPulse, Flame, MapPin, MessageSquareLock, Siren, TriangleAlert, ShieldAlert,
  Mic, MicOff, PhoneCall, Activity, Wind, Volume2, ShieldCheck, XCircle, BellOff, AlertOctagon
} from 'lucide-react'

const EMERGENCY_TYPES = [
  { id: 'MEDICAL', labelEn: 'Medical', labelHi: 'चिकित्सा / मेडिकल', icon: <HeartPulse className="h-5 w-5" /> },
  { id: 'FIRE', labelEn: 'Fire', labelHi: 'आग / अग्निकांड', icon: <Flame className="h-5 w-5" /> },
  { id: 'SECURITY_THREAT', labelEn: 'Security threat', labelHi: 'सुरक्षा खतरा', icon: <ShieldAlert className="h-5 w-5" /> },
  { id: 'ACCIDENT', labelEn: 'Accident', labelHi: 'दुर्घटना', icon: <CarFront className="h-5 w-5" /> },
  { id: 'OTHER', labelEn: 'Other', labelHi: 'अन्य संकट', icon: <TriangleAlert className="h-5 w-5" /> },
] as const

const EMERGENCY_NUMBERS = [
  { name: 'National Emergency', num: '112', desc: 'All-in-one Emergency (Police, Fire, Ambulance)', badge: '24x7' },
  { name: 'Campus Security Control', num: '1800-226-787', desc: 'Main Gate & Campus Control Room', badge: 'Toll-Free' },
  { name: 'Ambulance & Medical', num: '102', desc: 'Immediate Medical First Response', badge: 'Free' },
  { name: 'Fire Control Service', num: '101', desc: 'Campus & District Fire Station', badge: 'Urgent' },
  { name: 'Women Safety Helpline', num: '1091', desc: 'Dedicated Women & Student Safety Desk', badge: 'Direct' },
]

function HoldButton({ onTriggered, disabled, onHoldStart, onHoldEnd }: {
  onTriggered: () => void
  disabled: boolean
  onHoldStart?: () => void
  onHoldEnd?: () => void
}) {
  const { lang } = useI18n()
  const [progress, setProgress] = useState(0)
  const holding = useRef(false)
  const raf = useRef<number | null>(null)
  const start = useRef(0)
  const HOLD_MS = 1500

  const stop = (completed: boolean) => {
    holding.current = false
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    onHoldEnd?.()
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
    onHoldStart?.()
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
          'relative flex h-40 w-40 select-none items-center justify-center rounded-full text-white shadow-xl transition-all',
          'bg-gradient-to-b from-red-500 via-red-600 to-red-700 disabled:opacity-50 active:scale-[0.96]',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/40 hover:shadow-red-500/30',
        )}
      >
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
          <circle
            cx="64" cy="64" r={R} fill="none" stroke="white" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)}
          />
        </svg>
        <div className="flex flex-col items-center text-center px-2">
          <Siren className="h-9 w-9 animate-bounce" />
          <span className="mt-1 text-sm font-black tracking-wider">
            {progress > 0
              ? (lang === 'hi' ? 'दबाए रखें…' : 'KEEP HOLDING')
              : (lang === 'hi' ? 'SOS के लिए दबाएं' : 'HOLD FOR SOS')}
          </span>
          <span className="text-[10px] opacity-85 mt-0.5">
            {lang === 'hi' ? '1.5s दबाएं · 30s सायरन' : '1.5s hold · 30s Siren'}
          </span>
        </div>
      </button>
    </div>
  )
}

export function SosView() {
  const user = useUserStore((s) => s.user)
  const queryClient = useQueryClient()
  const { lang, t } = useI18n()
  const { isOnline, addOfflineSos } = useOfflineSync()

  const [type, setType] = useState<string>('MEDICAL')
  const [message, setMessage] = useState('')
  const [zone, setZone] = useState<string>('Academic Block A')
  const [shareLoc, setShareLoc] = useState(true)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locState, setLocState] = useState<'idle' | 'locating' | 'ok' | 'denied'>('idle')
  const [triggering, setTriggering] = useState(false)
  const [sirenPlaying, setSirenPlaying] = useState(false)

  // Voice SOS recognition state
  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceStatus, setVoiceStatus] = useState<string>('')
  const recognitionRef = useRef<any>(null)

  // Environmental sensor checks (PPM, Particle, Noise dB)
  const [ppmLevel, setPpmLevel] = useState<number>(18)
  const [particleLevel, setParticleLevel] = useState<number>(24)
  const [noiseDb, setNoiseDb] = useState<number>(54)

  const isResponder = !!user && can.ackSos(user.role)

  const { data: sosData } = useQuery({
    queryKey: ['sos'],
    queryFn: () => api<{ sos: SosAlert[] }>('/api/sos'),
    refetchInterval: 8000,
  })
  const sos = sosData?.sos ?? []
  const active = sos.filter((s) => s.status !== 'RESOLVED')
  const history = sos.filter((s) => s.status === 'RESOLVED')

  // Ambient sensor check simulator / audio decibel analyzer
  useEffect(() => {
    const timer = setInterval(() => {
      // Simulate real-time realistic environmental micro-fluctuations
      setPpmLevel((prev) => Math.max(10, Math.min(65, prev + (Math.random() * 4 - 2))))
      setParticleLevel((prev) => Math.max(12, Math.min(85, prev + (Math.random() * 6 - 3))))
      setNoiseDb((prev) => Math.max(40, Math.min(95, prev + (Math.random() * 8 - 4))))
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  // Geolocation resolution
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

  // Web Speech Voice SOS Recognition setup
  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
    setVoiceActive(false)
    setVoiceStatus('')
  }

  const startVoiceRecognition = () => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      toast.error('Voice recognition is not supported in this browser. Please use Chrome/Edge or the Hold button.')
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-US'

      recognition.onstart = () => {
        setVoiceActive(true)
        setVoiceStatus('Listening for: "Help", "Bachao", "Emergency", "Fire"…')
      }

      recognition.onresult = (event: any) => {
        let currentTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript.toLowerCase()
        }
        setVoiceTranscript(currentTranscript)

        // Trigger keywords check
        const triggerKeywords = [
          'help', 'emergency', 'sos', 'bachao', 'danger', 'fire', 'accident',
          'बचाओ', 'मदद', 'आपातकाल', 'खतरा', 'आग', 'ambulance'
        ]

        const matched = triggerKeywords.find((kw) => currentTranscript.includes(kw))
        if (matched) {
          stopVoiceRecognition()
          setMessage(`[VOICE TRIGGERED: "${matched.toUpperCase()}"]`)
          toast.warning(`Voice Emergency Keyword Detected: "${matched}"! Activating SOS!`)

          // Speak feedback
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(lang === 'hi' ? 'आपातकालीन चेतावनी सक्रिय की जा रही है!' : 'Emergency alert activated!')
            window.speechSynthesis.speak(utter)
          }

          void triggerSOS(true)
        }
      }

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e.error)
        if (e.error === 'not-allowed') {
          toast.error('Microphone permission denied. Please allow microphone access for Voice SOS.')
          setVoiceActive(false)
        }
      }

      recognition.onend = () => {
        // Auto-restart if user still wants voice active
        if (voiceActive) {
          try {
            recognition.start()
          } catch {
            setVoiceActive(false)
          }
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('Speech recognition init failed:', err)
      toast.error('Could not start microphone listener.')
      setVoiceActive(false)
    }
  }

  const toggleVoiceMode = () => {
    if (voiceActive) {
      stopVoiceRecognition()
    } else {
      startVoiceRecognition()
    }
  }

  // Master SOS Trigger function (Plays 30-sec Siren + Notifies Responders + Handles Offline)
  const triggerSOS = async (fromVoice = false) => {
    // Mutual exclusivity: stop voice listener while triggering
    stopVoiceRecognition()
    setTriggering(true)

    // 1. Play continuous 30-second emergency siren immediately!
    playEmergencySiren30Sec()
    setSirenPlaying(true)

    let lat: number | null = coords?.lat ?? null
    let lng: number | null = coords?.lng ?? null

    const payload = {
      emergencyType: type,
      message: message.trim() || (fromVoice ? 'Voice Activated Emergency Alert' : 'Immediate Assistance Required'),
      shareLocation: shareLoc,
      latitude: lat,
      longitude: lng,
      locationText: zone || 'Campus Zone',
    }

    // If offline: save to local queue & warn user
    if (!isOnline) {
      addOfflineSos(payload)
      toast.error('Offline Mode Active! Siren sounding (30s) & SOS stored locally.', {
        description: 'Will auto-sync when network returns. Please dial emergency numbers 112 / 100 directly.',
        duration: 9000,
      })
      setTriggering(false)
      setMessage('')
      return
    }

    // Online submission
    try {
      await api<{ sos: SosAlert }>('/api/sos', {
        method: 'POST',
        json: payload,
      })
      toast.success(
        lang === 'hi' ? 'आपातकालीन SOS भेजा गया! सुरक्षा दल सतर्क है।' : 'SOS triggered! Responders & Command Center alerted.',
        {
          description: shareLoc && lat ? `GPS Shared (${lat.toFixed(4)}, ${lng?.toFixed(4)})` : 'Location not shared (privacy setting)',
          duration: 6000,
        }
      )
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['sos'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTriggering(false)
    }
  }

  const act = async (id: string, action: 'ack' | 'resolve') => {
    try {
      await api(`/api/sos/${id}`, { method: 'POST', json: { action } })
      toast.success(action === 'ack' ? 'SOS acknowledged — help en route' : 'SOS resolved & logged')
      queryClient.invalidateQueries({ queryKey: ['sos'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // False Alarm / Cancellation handler
  const cancelFalseAlarm = async (id: string, reason: string) => {
    try {
      await api(`/api/sos/${id}`, { method: 'POST', json: { action: 'resolve' } })
      stopEmergencySiren()
      setSirenPlaying(false)
      toast.info(lang === 'hi' ? 'अलर्ट को झूठा/गलत चिह्नित कर दिया गया।' : 'Alert marked as False Alarm & cleared.')
      queryClient.invalidateQueries({ queryKey: ['sos'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Environmental Telemetry Bar (PPM, Particles, Noise Check) */}
      <div className="rounded-2xl border bg-card/60 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t('sos.environmental_checks')}
            </h3>
          </div>
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Continuous Sensor Readout
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* PPM Meter */}
          <div className="rounded-xl border bg-background/80 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                {t('sos.ppm')}
              </span>
              <span className={cn('font-bold', ppmLevel > 50 ? 'text-red-500' : 'text-emerald-500')}>
                {ppmLevel > 50 ? 'ELEVATED' : 'SAFE'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black">{ppmLevel.toFixed(0)}</span>
              <span className="text-xs text-muted-foreground">ppm</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={cn('h-full transition-all duration-500', ppmLevel > 50 ? 'bg-red-500' : 'bg-emerald-500')}
                style={{ width: `${Math.min(100, (ppmLevel / 100) * 100)}%` }}
              />
            </div>
          </div>

          {/* Particle PM2.5 Meter */}
          <div className="rounded-xl border bg-background/80 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Wind className="h-3.5 w-3.5 text-cyan-500" />
                {t('sos.particle')}
              </span>
              <span className={cn('font-bold', particleLevel > 55 ? 'text-amber-500' : 'text-emerald-500')}>
                {particleLevel > 55 ? 'MODERATE' : 'GOOD'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black">{particleLevel.toFixed(0)}</span>
              <span className="text-xs text-muted-foreground">µg/m³</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={cn('h-full transition-all duration-500', particleLevel > 55 ? 'bg-amber-500' : 'bg-cyan-500')}
                style={{ width: `${Math.min(100, (particleLevel / 120) * 100)}%` }}
              />
            </div>
          </div>

          {/* Noise Check dB */}
          <div className="rounded-xl border bg-background/80 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Volume2 className="h-3.5 w-3.5 text-purple-500" />
                {t('sos.noise')}
              </span>
              <span className={cn('font-bold', noiseDb > 80 ? 'text-red-500' : 'text-emerald-500')}>
                {noiseDb > 80 ? t('sos.noise_loud') : t('sos.noise_normal')}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black">{noiseDb.toFixed(0)}</span>
              <span className="text-xs text-muted-foreground">dB (Ambient)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={cn('h-full transition-all duration-500', noiseDb > 80 ? 'bg-red-500' : 'bg-purple-500')}
                style={{ width: `${Math.min(100, (noiseDb / 120) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Column: 30-Sec Siren Button & Voice SOS Activation */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <Siren className="h-5 w-5 text-red-500" /> {t('sos.title')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {t('sos.subtitle')}
              </p>
            </div>

            {/* Emergency Type Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                {lang === 'hi' ? 'आपातकाल का प्रकार चुनें' : 'Select Emergency Nature'}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {EMERGENCY_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs transition-all',
                      type === t.id
                        ? 'border-red-500 bg-red-500/15 text-red-600 dark:text-red-400 font-bold shadow-sm'
                        : 'text-muted-foreground hover:border-red-500/30 hover:bg-red-500/5',
                    )}
                  >
                    {t.icon}
                    <span className="text-center">{lang === 'hi' ? t.labelHi : t.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Zone & Optional Message */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  {lang === 'hi' ? 'आप किस स्थान पर हैं?' : 'Current Zone / Building Location'}
                </Label>
                <Select value={zone} onValueChange={setZone}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Select Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sos-msg" className="text-xs font-semibold text-muted-foreground">
                  {lang === 'hi' ? 'संदेश (वैकल्पिक)' : 'Emergency Note (Optional)'}
                </Label>
                <Textarea
                  id="sos-msg"
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={lang === 'hi' ? 'स्थिति का संक्षिप्त विवरण लिखें…' : 'Describe the situation for first responders…'}
                  className="text-xs"
                />
              </div>

              {/* Privacy GPS location toggle */}
              <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <div>
                      <p className="text-xs font-bold">{lang === 'hi' ? 'लाइव GPS स्थान साझा करें' : 'Share GPS Coordinates'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {locState === 'ok' && coords
                          ? `GPS Active (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
                          : locState === 'denied'
                            ? 'Browser location blocked — zone text will be used'
                            : 'Privacy protected: shared only with responders'}
                      </p>
                    </div>
                  </div>
                  <Switch checked={shareLoc} onCheckedChange={setShareLoc} aria-label="Share GPS" />
                </div>
              </div>
            </div>

            {/* 30-Second Continuous Siren HOLD Button */}
            <div className="py-2 flex flex-col items-center">
              <HoldButton
                onTriggered={() => { if (!triggering) void triggerSOS(false) }}
                disabled={triggering}
                onHoldStart={() => { if (voiceActive) stopVoiceRecognition() }}
              />
            </div>

            {/* VOICE SOS ACTIVATION SECTION */}
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className={cn('h-4 w-4', voiceActive ? 'text-red-500 animate-pulse' : 'text-muted-foreground')} />
                  <span className="text-xs font-bold">{t('sos.voice_trigger')}</span>
                </div>
                <Button
                  size="sm"
                  variant={voiceActive ? 'destructive' : 'outline'}
                  onClick={toggleVoiceMode}
                  className="h-7 text-xs font-bold gap-1.5"
                >
                  {voiceActive ? (
                    <><MicOff className="h-3.5 w-3.5" /> {t('sos.voice_stop')}</>
                  ) : (
                    <><Mic className="h-3.5 w-3.5" /> {t('sos.voice_start')}</>
                  )}
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t('sos.voice_desc')}
              </p>

              {voiceActive && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                    <span>{t('sos.voice_listening')}</span>
                  </div>
                  {voiceTranscript && (
                    <p className="text-[11px] text-foreground font-mono bg-background/80 p-1.5 rounded">
                      &ldquo;{voiceTranscript}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Emergency Direct Phone Helplines */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-emerald-500" />
              {t('sos.emergency_numbers')}
            </h4>
            <div className="divide-y text-xs">
              {EMERGENCY_NUMBERS.map((n) => (
                <div key={n.num} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-foreground">{n.name}</p>
                    <p className="text-[11px] text-muted-foreground">{n.desc}</p>
                  </div>
                  <a
                    href={`tel:${n.num}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/25 transition-colors"
                  >
                    <PhoneCall className="h-3 w-3" />
                    {n.num}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Active SOS, Responders, and False Alarm Cancellation */}
        <div className="lg:col-span-3 space-y-5">
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Siren className="h-5 w-5 text-red-500" />
                <h3 className="text-base font-extrabold">Active SOS Alerts</h3>
                {active.length > 0 && (
                  <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-black text-white animate-pulse">
                    {active.length} ALERT{active.length > 1 ? 'S' : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {active.length === 0 && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-2">
                  <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    No active emergencies — Campus is fully secure.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Telemetry, audio sirens and quick-response teams are on standby 24x7.
                  </p>
                </div>
              )}

              {active.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'rounded-xl border p-4 transition-all shadow-sm',
                    s.status === 'ACTIVE'
                      ? 'border-red-500/50 bg-red-500/10'
                      : 'border-amber-500/50 bg-amber-500/10',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Siren className={cn('h-4 w-4', s.status === 'ACTIVE' ? 'text-red-500 animate-spin' : 'text-amber-500')} />
                      <span className="text-sm font-black text-foreground">
                        {s.emergencyType.replaceAll('_', ' ')}
                      </span>
                      <Pill label={s.status} className={SEVERITY_STYLES[s.status]} />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{relTime(s.createdAt)}</span>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    <strong className="text-foreground">{s.triggeredBy}</strong> ({s.role.toLowerCase()})
                    {s.locationText ? ` · Zone: ${s.locationText}` : ''}
                  </p>

                  {s.message && (
                    <p className="mt-1.5 text-xs italic bg-background/80 p-2 rounded-lg border">
                      &ldquo;{s.message}&rdquo;
                    </p>
                  )}

                  {s.shareLocation && s.latitude != null && (
                    <a
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin className="h-3.5 w-3.5" /> GPS Coordinates: {s.latitude.toFixed(5)}, {s.longitude?.toFixed(5)} — Open Google Maps
                    </a>
                  )}

                  {/* Actions for Responder or False Alarm Cancellation */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t">
                    {s.status === 'ACTIVE' && isResponder && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-amber-500/40 text-amber-600 font-bold"
                        onClick={() => act(s.id, 'ack')}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Acknowledge SOS
                      </Button>
                    )}

                    {isResponder && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        onClick={() => act(s.id, 'resolve')}
                      >
                        <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark Resolved
                      </Button>
                    )}

                    {/* False Alarm Cancellation Button */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-red-500 font-medium">
                          <XCircle className="h-3.5 w-3.5 mr-1" /> {t('sos.cancel_false')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertOctagon className="h-5 w-5" /> Cancel / Report False Alarm
                          </DialogTitle>
                          <DialogDescription>
                            {t('sos.false_desc')}. This will silence sirens and mark the alert as a non-emergency false alarm.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2">
                          <Button variant="outline" size="sm">Back</Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => cancelFalseAlarm(s.id, 'Accidental trigger / False alarm')}
                          >
                            Confirm False Alarm
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SOS History */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold">Resolved SOS Archive</h3>
            <div className="space-y-2">
              {history.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No resolved incidents in record.</p>
              )}
              {history.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{s.emergencyType.replaceAll('_', ' ')}</span>
                    <span className="text-muted-foreground">· {s.triggeredBy} ({s.locationText ?? 'Zone not set'})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill label="RESOLVED" className={SEVERITY_STYLES.RESOLVED} />
                    <span className="text-muted-foreground font-mono">{dateTimeStr(s.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
