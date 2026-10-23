'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { api, clearSession } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { can } from '@/lib/permissions'
import { useLiveStore } from '@/lib/live-store'
import { useLiveEvents } from '@/hooks/use-live'
import type { Role } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/types'
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
} from 'lucide-react'

type ViewId = 'dashboard' | 'monitoring' | 'security' | 'sos' | 'maintenance'

const NAV: { id: ViewId; label: string; icon: React.ReactNode; roles?: Role[]; hint: string }[] = [
  { id: 'dashboard', label: 'Command Center', icon: <LayoutDashboard className="h-4 w-4" />, hint: 'Building overview' },
  { id: 'monitoring', label: 'Building Monitor', icon: <Gauge className="h-4 w-4" />, hint: 'Live sensors & limits' },
  { id: 'security', label: 'Security', icon: <ShieldCheck className="h-4 w-4" />, roles: ['STAFF', 'SECURITY', 'ADMIN'], hint: 'Access & visitors' },
  { id: 'sos', label: 'Emergency SOS', icon: <Siren className="h-4 w-4" />, hint: 'Trigger & respond' },
  { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="h-4 w-4" />, hint: 'Fault reports & repairs' },
]

function ConnectionChip() {
  const connection = useLiveStore((s) => s.connection)
  const map = {
    connected: { label: 'Live', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30 bg-emerald-500/10' },
    connecting: { label: 'Connecting…', dot: 'bg-amber-500 animate-pulse', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30 bg-amber-500/10' },
    disconnected: { label: 'Reconnecting…', dot: 'bg-red-500 animate-pulse', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30 bg-red-500/10' },
  }[connection]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium', map.border, map.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', map.dot)} />
      {map.label}
    </span>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="outline" size="icon" aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {/* Icon visibility is CSS-driven so no mount state is needed */}
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
  const [view, setView] = useState<ViewId>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useLiveEvents()

  if (!user) return null

  const nav = NAV.filter((n) => !n.roles || n.roles.includes(user.role))
  const current = nav.find((n) => n.id === view) ?? nav[0]

  const logout = () => {
    clearSession()
    setUser(null)
    setView('dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <CriticalFlash />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
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

          <div className="hidden md:flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight">CampusGuard</p>
              <p className="text-[10px] text-muted-foreground">Smart Building Safety &amp; Security · TechTrix&apos;26</p>
            </div>
          </div>

          <div className="mx-auto md:mx-0 md:ml-6 hidden sm:block">
            <ConnectionChip />
          </div>
          <div className="sm:hidden mx-auto">
            <ConnectionChip />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label={soundEnabled ? 'Mute alerts' : 'Unmute alerts'} onClick={toggleSound}>
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <ThemeToggle />
            <AlertsCenter />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 px-2 sm:px-3">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
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
                  <LogOut className="h-4 w-4" /> Sign out / switch role
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r">
          <nav className="flex-1 space-y-1 p-3">
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors text-left',
                  view === n.id
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-current={view === n.id ? 'page' : undefined}
              >
                {n.icon}
                <span className="flex-1">
                  {n.label}
                  <span className="block text-[10px] font-normal opacity-70">{n.hint}</span>
                </span>
              </button>
            ))}
          </nav>
          <div className="border-t p-3 space-y-2">
            <p className="rounded-lg bg-muted/60 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Prototype demo.</strong> Sensor readings and access events are
              simulated by an on-device service, as permitted by the problem statement.
            </p>
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
                    'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm',
                    view === n.id ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-muted-foreground',
                  )}
                >
                  {n.icon} {n.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0 p-3 sm:p-5 pb-24 md:pb-8">
          <div className="mb-4">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">{current.label}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {view === 'dashboard' && 'Live status across all zones — alerts, incidents, repairs and response info.'}
              {view === 'monitoring' && 'Simulated sensor network with automatic threshold alerts (Module 1).'}
              {view === 'security' && 'Restricted-area access logs, visitor register and intrusion alerts (Module 2).'}
              {view === 'sos' && 'One-tap emergency alerts with privacy-first location sharing (Module 3).'}
              {view === 'maintenance' && 'Report faults with photos and track repairs to resolution (Module 4).'}
            </p>
          </div>

          {view === 'dashboard' && <DashboardView />}
          {view === 'monitoring' && <MonitoringView />}
          {view === 'security' && <SecurityView />}
          {view === 'sos' && <SosView />}
          {view === 'maintenance' && <MaintenanceView />}

          {/* Sticky footer */}
          <footer className="mt-8 border-t pt-4 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-foreground/70">CampusGuard</span>
            <span>TechTrix&apos;26 · Project 8 — Smart Building Safety, Security &amp; Maintenance Monitoring</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live data stream active
            </span>
          </footer>
        </main>
      </div>
    </div>
  )
}
