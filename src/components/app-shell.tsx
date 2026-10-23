'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { clearSession } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { can } from '@/lib/permissions'
import { useLiveStore } from '@/lib/live-store'
import { useLiveEvents } from '@/hooks/use-live'
import type { Role } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { useOfflineSync } from '@/lib/offline-sync'
import { subscribeSiren, stopEmergencySiren } from '@/lib/beep'
import { cn } from '@/lib/utils'
import { AlertsCenter, CriticalFlash } from '@/components/alerts-center'
import { DashboardView } from '@/components/dashboard-view'
import { MonitoringView } from '@/components/monitoring-view'
import { SecurityView } from '@/components/security-view'
import { SosView } from '@/components/sos-view'
import { MaintenanceView } from '@/components/maintenance-view'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Gauge, LayoutDashboard, LogOut, Moon, ShieldCheck, Siren, Sun, Volume2, VolumeX, Wrench, ChevronDown,
  Languages, WifiOff, BellOff
} from 'lucide-react'

type ViewId = 'dashboard' | 'monitoring' | 'security' | 'sos' | 'maintenance'

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="outline" size="icon" aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="h-9 w-9"
    >
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
    </Button>
  )
}

export function AppShell() {
  const user = useUserStore((s) => s.user)
  const setUser = useUserStore((s) => s.setUser)
  const soundEnabled = useLiveStore((s) => s.soundEnabled)
  const toggleSound = useLiveStore((s) => s.toggleSound)
  const { lang, toggleLang, t } = useI18n()
  const { isOnline, sosQueue, reportQueue } = useOfflineSync()

  const [view, setView] = useState<ViewId>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sirenActive, setSirenActive] = useState(false)
  const [sirenSec, setSirenSec] = useState(0)

  useLiveEvents()

  // Subscribe to 30-sec emergency siren state
  useEffect(() => {
    return subscribeSiren((active, rem) => {
      setSirenActive(active)
      setSirenSec(rem)
    })
  }, [])

  if (!user) return null

  const NAV: { id: ViewId; labelKey: string; icon: React.ReactNode; roles?: Role[]; hintKey: string }[] = [
    { id: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard className="h-4 w-4" />, hintKey: 'nav.dashboard.hint' },
    { id: 'monitoring', labelKey: 'nav.monitoring', icon: <Gauge className="h-4 w-4" />, hintKey: 'nav.monitoring.hint' },
    { id: 'security', labelKey: 'nav.security', icon: <ShieldCheck className="h-4 w-4" />, roles: ['STAFF', 'SECURITY', 'ADMIN'], hintKey: 'nav.security.hint' },
    { id: 'sos', labelKey: 'nav.sos', icon: <Siren className="h-4 w-4" />, hintKey: 'nav.sos.hint' },
    { id: 'maintenance', labelKey: 'nav.maintenance', icon: <Wrench className="h-4 w-4" />, hintKey: 'nav.maintenance.hint' },
  ]

  const nav = NAV.filter((n) => !n.roles || n.roles.includes(user.role))
  const current = nav.find((n) => n.id === view) ?? nav[0]

  const logout = () => {
    clearSession()
    setUser(null)
    setView('dashboard')
  }

  const queuedTotal = sosQueue.length + reportQueue.length

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <CriticalFlash />

      {/* 30-Second Continuous Emergency Siren Banner */}
      {sirenActive && (
        <div className="sticky top-0 z-50 bg-red-600 text-white px-4 py-2 text-sm font-bold flex items-center justify-between shadow-lg siren-pulse">
          <div className="flex items-center gap-2">
            <Siren className="h-5 w-5 animate-spin" />
            <span>{t('header.siren_active')} — {sirenSec}s remaining</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={stopEmergencySiren}
            className="h-7 text-xs bg-white text-red-700 hover:bg-slate-100 font-bold"
          >
            <BellOff className="h-3.5 w-3.5 mr-1" />
            {t('header.silence_siren')}
          </Button>
        </div>
      )}

      {/* Offline Mode Banner (Internet connection ho ya na ho dono case mein kaam karega) */}
      {!isOnline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-700 dark:text-amber-400 px-4 py-1.5 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="h-3.5 w-3.5" />
            <span>{t('header.offline')}</span>
            {queuedTotal > 0 && <span className="bg-amber-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">({queuedTotal} queued)</span>}
          </div>
          <span className="text-[11px] font-normal opacity-90">Auto-syncs upon reconnect</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
        <div className="flex h-14 items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden flex items-center gap-2"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              <div className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', mobileNavOpen && 'rotate-180')} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-600 dark:text-emerald-400 cyber-glow">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-extrabold tracking-tight">CampusGuard</p>
                <p className="text-[10px] text-muted-foreground font-medium hidden sm:block">Command &amp; Telemetry Hub</p>
              </div>
            </div>
          </div>

          {/* Right Header Utilities: Dual-Language Toggle, Sound, Theme, Alerts, User Profile */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLang}
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              title="Switch language between English and हिन्दी"
            >
              <Languages className="h-3.5 w-3.5" />
              <span>{lang === 'en' ? 'हिन्दी' : 'English'}</span>
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label={soundEnabled ? 'Mute alerts' : 'Unmute alerts'}
              onClick={toggleSound}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            </Button>

            <ThemeToggle />
            <AlertsCenter />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 px-2 sm:px-3 h-8">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </span>
                  <span className="hidden lg:block text-left leading-tight">
                    <span className="block text-xs font-semibold">{user.name}</span>
                    <span className="block text-[10px] text-muted-foreground">{ROLE_LABELS[user.role]}</span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">{user.dept}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
                  <LogOut className="h-4 w-4 mr-1.5" /> {t('header.signout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-card/40">
          <nav className="flex-1 space-y-1.5 p-3">
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all text-left cyber-card',
                  view === n.id
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-current={view === n.id ? 'page' : undefined}
              >
                <div className={cn(
                  'p-1.5 rounded-lg',
                  view === n.id ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-muted/70 text-muted-foreground'
                )}>
                  {n.icon}
                </div>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{t(n.labelKey)}</span>
                  <span className="block text-[10px] font-normal opacity-70 truncate">{t(n.hintKey)}</span>
                </span>
              </button>
            ))}
          </nav>

          {/* Clean system status in sidebar */}
          <div className="border-t p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Security Engine</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Armed &amp; Ready
              </span>
            </div>
          </div>
        </aside>

        {/* Mobile nav dropdown */}
        {mobileNavOpen && (
          <div className="md:hidden fixed inset-x-0 top-14 z-30 border-b bg-background p-3 shadow-lg">
            <nav className="grid grid-cols-2 gap-2">
              {nav.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setView(n.id); setMobileNavOpen(false) }}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold',
                    view === n.id ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground',
                  )}
                >
                  {n.icon} {t(n.labelKey)}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0 p-3 sm:p-6 pb-20 md:pb-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">{t(current.labelKey)}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {view === 'dashboard' && (lang === 'hi' ? 'सभी क्षेत्रों की लाइव स्थिति — अलर्ट, घटनाएं, मरम्मत व आंकड़े।' : 'Real-time overview across all campus zones — alerts, incidents, repairs & telemetry.')}
                {view === 'monitoring' && (lang === 'hi' ? 'सेंसर नेटवर्क टेलीमेट्री व स्वचालित थ्रेसहोल्ड अलर्ट।' : 'Multi-sensor telemetry with automatic threshold limit monitoring.')}
                {view === 'security' && (lang === 'hi' ? 'सुरक्षित क्षेत्र प्रवेश लॉग्स, आगंतुक त्वरित प्रविष्टि व घुसपैठ अलर्ट।' : 'Restricted-area access logs, rapid visitor check-ins & intrusion alerts.')}
                {view === 'sos' && (lang === 'hi' ? '30-सेकंड सायरन, वॉयस एक्टिवेशन व पर्यावरण खतरा जांच सहित आपातकालीन SOS।' : 'One-tap & voice-activated SOS with continuous 30-second siren & environmental checks.')}
                {view === 'maintenance' && (lang === 'hi' ? 'सीधा कैमरा फोटो सत्यापन व कार्यक्षेत्र अनुसार तकनीशियन चयन सहित शिकायत प्रबंधन।' : 'Direct camera photo verification, field-wise technician dispatch & repair tracking.')}
              </p>
            </div>
          </div>

          {view === 'dashboard' && <DashboardView />}
          {view === 'monitoring' && <MonitoringView />}
          {view === 'security' && <SecurityView />}
          {view === 'sos' && <SosView />}
          {view === 'maintenance' && <MaintenanceView />}

          {/* Clean footer */}
          <footer className="mt-12 border-t pt-4 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-foreground/80">CampusGuard Secure Campus Telemetry</span>
            <span>All systems nominal · Offline-ready architecture</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
