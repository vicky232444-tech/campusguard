'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, saveSession } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import type { Role, SessionUser } from '@/lib/types'
import { ROLE_BLURBS, ROLE_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  Building2, ShieldCheck, Loader2, Radio, Eye, EyeOff, User as UserIcon,
  KeyRound, LogIn, AlertCircle, ChevronDown, CheckCircle2,
} from 'lucide-react'

type AccountInfo = {
  id: string
  name: string
  username: string
  role: string
  dept: string | null
  color: string
}

/** Demo passwords shown only in the UI helper (never exposed by the API). */
const DEMO_PASSWORDS: Record<string, string> = {
  aarav: 'aarav123',
  priya: 'priya123',
  vikram: 'vikram123',
  meera: 'meera123',
  admin: 'admin123',
}

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  STUDENT: <Building2 className="h-5 w-5" />,
  STAFF: <Building2 className="h-5 w-5" />,
  SECURITY: <ShieldCheck className="h-5 w-5" />,
  MAINTENANCE: <Building2 className="h-5 w-5" />,
  ADMIN: <ShieldCheck className="h-5 w-5" />,
}

export function LoginScreen() {
  const router = useRouter()
  const setUser = useUserStore((s) => s.setUser)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [accounts, setAccounts] = useState<AccountInfo[] | null>(null)
  const [showAccounts, setShowAccounts] = useState(false)
  const [serverDown, setServerDown] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<{ users: AccountInfo[] }>('/api/auth/session')
      .then((d) => setAccounts(d.users))
      .catch(() => setServerDown(true))
  }, [])

  const trimmed = username.trim()
  const canSubmit = trimmed.length >= 3 && password.length >= 6 && !submitting && !success

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!canSubmit && !submitting) {
      if (trimmed.length < 3) setError('Username must be at least 3 characters.')
      else if (password.length < 6) setError('Password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { user, token } = await api<{ user: SessionUser; token: string }>('/api/auth/login', {
        method: 'POST',
        json: { username: trimmed, password },
      })
      saveSession(user, token)
      setUser(user)
      setSuccess(true)
      setTimeout(() => router.refresh(), 450)
    } catch (err) {
      setError((err as Error).message)
      setPassword('')
      setSubmitting(false)
      usernameRef.current?.focus()
    }
  }

  const fillDemo = (u: AccountInfo) => {
    setUsername(u.username)
    setPassword(DEMO_PASSWORDS[u.username] ?? '')
    setError(null)
    usernameRef.current?.focus()
  }

  const helperText = useMemo(() => {
    if (trimmed && password) return null
    if (trimmed && !password) return 'Enter your password to continue.'
    return null
  }, [trimmed, password])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 grid lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden lg:flex flex-col justify-between p-10 border-r bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.12),transparent_55%)]">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">CampusGuard</h1>
              <p className="text-xs text-muted-foreground">Safety · Security · Maintenance — one platform</p>
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <div>
              <h2 className="text-3xl font-bold leading-tight">
                One command center for your entire building.
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Live sensor monitoring, restricted-area security, emergency SOS with location sharing, and
                repair tracking — unified for schools, colleges and public buildings.
              </p>
            </div>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Radio className="h-4 w-4 text-emerald-500" /> Live sensor network with automatic anomaly alerts</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Access logs, visitor records &amp; intrusion alerts</li>
              <li className="flex items-center gap-2"><Building2 className="h-4 w-4 text-emerald-500" /> SOS with privacy-first location sharing</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">TechTrix&apos;26 · Project 8 — Smart Building Safety, Security &amp; Maintenance Monitoring System</p>
        </div>

        {/* Login form */}
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <div className="mx-auto w-full max-w-md space-y-6">
            <div className="lg:hidden flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold">CampusGuard</h1>
                <p className="text-xs text-muted-foreground">TechTrix&apos;26 · Project 8</p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight">Sign in to your account</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Every member — student, staff, security, maintenance and admin — has individual credentials.
              </p>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2.5 text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div role="status" className="flex items-start gap-2.5 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Signed in successfully — opening your dashboard…</span>
              </div>
            )}
            {serverDown && (
              <div role="alert" className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
                Could not reach the server. Please wait a moment and retry.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Username */}
              <div className="space-y-1.5">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    ref={usernameRef}
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="e.g. admin"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(null) }}
                    disabled={submitting || success}
                    className={cn(
                      'w-full h-11 rounded-lg border bg-card pl-10 pr-3 text-sm outline-none transition-colors',
                      'placeholder:text-muted-foreground/60',
                      'focus-visible:border-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500/25',
                      'disabled:opacity-60',
                    )}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null) }}
                    disabled={submitting || success}
                    className={cn(
                      'w-full h-11 rounded-lg border bg-card pl-10 pr-11 text-sm outline-none transition-colors',
                      'placeholder:text-muted-foreground/60',
                      'focus-visible:border-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500/25',
                      'disabled:opacity-60',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting || success}
                className={cn(
                  'w-full h-11 rounded-lg bg-emerald-600 text-white text-sm font-semibold',
                  'inline-flex items-center justify-center gap-2 transition-all',
                  'hover:bg-emerald-500 active:scale-[0.99]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'disabled:opacity-70 disabled:pointer-events-none',
                )}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Verifying credentials…</>
                ) : success ? (
                  <><CheckCircle2 className="h-4 w-4" /> Signed in</>
                ) : (
                  <><LogIn className="h-4 w-4" /> Sign in</>
                )}
              </button>
            </form>

            {/* Demo accounts helper */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAccounts((v) => !v)}
                aria-expanded={showAccounts}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Demo accounts — username &amp; password
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showAccounts && 'rotate-180')} />
              </button>
              {showAccounts && (
                <div className="border-t divide-y">
                  {!accounts && (
                    <p className="px-4 py-3 text-xs text-muted-foreground">Loading accounts…</p>
                  )}
                  {accounts?.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => fillDemo(u)}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-accent/50 transition-colors group"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: u.color }}
                      >
                        {ROLE_ICONS[u.role as Role]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-medium text-sm">{u.name}</span>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            {ROLE_LABELS[u.role as Role]}
                          </span>
                        </span>
                        <span className="block text-xs text-muted-foreground font-mono mt-0.5">
                          {u.username} · {DEMO_PASSWORDS[u.username] ?? '—'}
                        </span>
                        <span className="sr-only">{ROLE_BLURBS[u.role as Role]}</span>
                      </span>
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        Fill →
                      </span>
                    </button>
                  ))}
                  <p className="px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    Tap any account to autofill the form. Passwords are hashed (scrypt) in the database and
                    verified server-side on sign-in.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
