'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  INFO: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
  LOW: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  NORMAL: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  WARNING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
}

export const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  ACKNOWLEDGED: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  RESOLVED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  PENDING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  APPROVED: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
  IN_PROGRESS: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
  PROOF_SUBMITTED: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  AWAITING_ADMIN: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  REJECTED: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  ISSUED: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  WAIVED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  MATCHED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  MISMATCHED: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  AUTHENTIC: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  MORPHED: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  INSIDE: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
  CHECKED_OUT: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  ACCESS_GRANTED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  ACCESS_DENIED: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  TAILGATING: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  AFTER_HOURS: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  DOOR_HELD_OPEN: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
}

export function Pill({ label, className }: { label: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium px-1.5 py-0', className)}>
      {label.replaceAll('_', ' ')}
    </Badge>
  )
}

export function SimBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Telemetry Active
    </span>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  sub?: string
  icon: ReactNode
  tone?: 'neutral' | 'danger' | 'warning' | 'success' | 'info'
}) {
  const tones = {
    neutral: 'text-foreground',
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    info: 'text-sky-600 dark:text-sky-400',
  }
  const iconBg = {
    neutral: 'bg-muted text-muted-foreground',
    danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  }
  return (
    <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
      <div className={cn('rounded-lg p-2', iconBg[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-semibold leading-tight', tones[tone])}>{value}</p>
        {sub ? <p className="text-[11px] text-muted-foreground truncate">{sub}</p> : null}
      </div>
    </div>
  )
}

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function dateTimeStr(iso: string): string {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
