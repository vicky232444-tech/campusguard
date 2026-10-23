'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/35 shadow-xs',
  HIGH: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/35 shadow-xs',
  MEDIUM: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35 shadow-xs',
  INFO: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/35 shadow-xs',
  LOW: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/35 shadow-xs',
  NORMAL: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 shadow-xs',
  WARNING: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35 shadow-xs',
}

export const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 shadow-xs font-bold',
  ACKNOWLEDGED: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35 shadow-xs',
  RESOLVED: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 shadow-xs',
  PENDING: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35 shadow-xs',
  APPROVED: 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/35 shadow-xs',
  IN_PROGRESS: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/35 shadow-xs',
  PROOF_SUBMITTED: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/35 shadow-xs',
  AWAITING_ADMIN: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/35 shadow-xs',
  REJECTED: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/35 shadow-xs',
  ISSUED: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/35 shadow-xs',
  WAIVED: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 shadow-xs',
  MATCHED: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 shadow-xs',
  MISMATCHED: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/35 shadow-xs',
  AUTHENTIC: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 shadow-xs',
  MORPHED: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/35 shadow-xs',
  INSIDE: 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/35 shadow-xs',
  CHECKED_OUT: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/35 shadow-xs',
  ACCESS_GRANTED: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 shadow-xs',
  ACCESS_DENIED: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/35 shadow-xs',
  TAILGATING: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/35 shadow-xs',
  AFTER_HOURS: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/35 shadow-xs',
  DOOR_HELD_OPEN: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35 shadow-xs',
  PAID: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 shadow-xs',
  REJECTED_FALSE: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/35 shadow-xs',
  REJECTED_UNVERIFIED: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35 shadow-xs',
}

export function Pill({ label, className }: { label?: string | null; className?: string }) {
  const text = String(label ?? '').replaceAll('_', ' ')
  return (
    <Badge variant="outline" className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-xs', className)}>
      {text || 'N/A'}
    </Badge>
  )
}

export function SimBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-gradient-to-b from-emerald-500/15 to-emerald-500/5 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-700 dark:text-emerald-400 shadow-xs',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
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

  const topAccents = {
    neutral: 'border-t-3 border-t-slate-400 dark:border-t-slate-600',
    danger: 'border-t-3 border-t-red-500',
    warning: 'border-t-3 border-t-amber-500',
    success: 'border-t-3 border-t-emerald-500',
    info: 'border-t-3 border-t-sky-500',
  }

  const iconBg = {
    neutral: 'bg-gradient-to-b from-muted to-muted/80 text-muted-foreground border border-black/5 dark:border-white/10 shadow-xs',
    danger: 'bg-gradient-to-b from-red-500/20 to-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 shadow-[0_2px_6px_rgba(239,68,68,0.2)]',
    warning: 'bg-gradient-to-b from-amber-500/20 to-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 shadow-[0_2px_6px_rgba(245,158,11,0.2)]',
    success: 'bg-gradient-to-b from-emerald-500/20 to-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shadow-[0_2px_6px_rgba(16,185,129,0.2)]',
    info: 'bg-gradient-to-b from-sky-500/20 to-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30 shadow-[0_2px_6px_rgba(14,165,233,0.2)]',
  }

  return (
    <div className={cn(
      'rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/95 p-4 flex items-start gap-3.5 shadow-[0_2px_4px_rgba(0,0,0,0.02),0_6px_14px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.04),0_12px_22px_rgba(0,0,0,0.07)] hover:-translate-y-1 transition-all duration-200 card-3d',
      topAccents[tone]
    )}>
      <div className={cn('rounded-xl p-2.5 shrink-0 icon-container-3d', iconBg[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-black leading-tight tracking-tight mt-0.5', tones[tone])}>{value}</p>
        {sub ? <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-medium">{sub}</p> : null}
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
