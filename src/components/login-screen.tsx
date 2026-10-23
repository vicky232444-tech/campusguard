'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, saveSession } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import type { Role, SessionUser } from '@/lib/types'
import { ROLE_BLURBS, ROLE_LABELS } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Building2, ShieldCheck, Loader2, Radio, Eye, EyeOff, User as UserIcon,
  KeyRound, LogIn, AlertCircle, ChevronDown, CheckCircle2, UserPlus, Mail,
  GraduationCap, Briefcase, Languages
} from 'lucide-react'

type AccountInfo = {
  id: string
  name: string
  username: string
  role: string
  dept: string | null
  color: string
}

const DEMO_PASSWORDS: Record<string, string> = {
  aarav: 'aarav123',
  priya: 'priya123',
  vikram: 'vikram123',
  meera: 'meera123',
  admin: 'admin123',
}

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  STUDENT: <GraduationCap className="h-4 w-4" />,
  STAFF: <Briefcase className="h-4 w-4" />,
  SECURITY: <ShieldCheck className="h-4 w-4" />,
  MAINTENANCE: <Building2 className="h-4 w-4" />,
  ADMIN: <ShieldCheck className="h-4 w-4" />,
}

export function LoginScreen() {
  const router = useRouter()
  const setUser = useUserStore((s) => s.setUser)
  const { lang, toggleLang, t } = useI18n()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  // Sign in state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [accounts, setAccounts] = useState<AccountInfo[] | null>(null)
  const [showAccounts, setShowAccounts] = useState(false)
  const [serverDown, setServerDown] = useState(false)

  // Sign up state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [regRole, setRegRole] = useState<'STUDENT' | 'STAFF' | 'SECURITY' | 'MAINTENANCE'>('STUDENT')
  const [dept, setDept] = useState('')

  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<{ users: AccountInfo[] }>('/api/auth/session')
      .then((d) => setAccounts(d.users))
      .catch(() => setServerDown(true))
  }, [])

  const trimmed = username.trim()

  const handleSignIn = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (trimmed.length < 3) {
      setError(lang === 'hi' ? 'यूजरनेम कम से कम 3 अक्षरों का होना चाहिए।' : 'Username must be at least 3 characters.')
      return
    }
    if (password.length < 6) {
      setError(lang === 'hi' ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' : 'Password must be at least 6 characters.')
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

  const handleSignUp = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (name.trim().length < 2) {
      setError(lang === 'hi' ? 'कृपया अपना पूरा नाम दर्ज करें।' : 'Please enter your full name.')
      return
    }
    if (trimmed.length < 3) {
      setError(lang === 'hi' ? 'यूजरनेम कम से कम 3 अक्षरों का होना चाहिए।' : 'Username must be at least 3 characters.')
      return
    }
    if (!email.includes('@')) {
      setError(lang === 'hi' ? 'कृपया मान्य ईमेल दर्ज करें।' : 'Please enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError(lang === 'hi' ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' : 'Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const { user, token } = await api<{ user: SessionUser; token: string }>('/api/auth/register', {
        method: 'POST',
        json: {
          name: name.trim(),
          username: trimmed,
          email: email.trim().toLowerCase(),
          password,
          role: regRole,
          dept: dept.trim() || 'General',
        },
      })
      saveSession(user, token)
      setUser(user)
      setSuccess(true)
      setTimeout(() => router.refresh(), 450)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  const fillDemo = (u: AccountInfo) => {
    setMode('signin')
    setUsername(u.username)
    setPassword(DEMO_PASSWORDS[u.username] ?? '')
    setError(null)
    usernameRef.current?.focus()
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top language and theme bar */}
      <div className="flex justify-end items-center px-6 py-3 border-b bg-muted/20">
        <button
          onClick={toggleLang}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
        >
          <Languages className="h-3.5 w-3.5" />
          <span>{lang === 'en' ? 'हिन्दी में बदलें (Hindi)' : 'Switch to English'}</span>
        </button>
      </div>

      <div className="flex-1 grid lg:grid-cols-2">
        {/* Brand Command Center Panel */}
        <div className="relative hidden lg:flex flex-col justify-between p-12 border-r bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.18),transparent_60%)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/20 p-3 text-emerald-600 dark:text-emerald-400 cyber-glow">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">CampusGuard</h1>
              <p className="text-xs text-muted-foreground">{t('header.subtitle')}</p>
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-3">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Protection Engine
              </span>
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
                {lang === 'hi'
                  ? 'संपूर्ण परिसर के लिए आधुनिक सुरक्षा व कमान केंद्र।'
                  : 'Modern Safety & Security Command Center for Your Entire Campus.'}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {lang === 'hi'
                  ? 'सेंसर नेटवर्क, आपातकालीन वॉयस व 30-सेकंड सायरन SOS, आगंतुक प्रबंधन और फोटो सत्यापन युक्त रखरखाव प्रणाली।'
                  : 'Automated sensor telemetry, emergency SOS with continuous 30-second siren & voice activation, fast visitor check-ins, and verified maintenance reports.'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3 rounded-lg border bg-card/60 p-2.5">
                <Radio className="h-4 w-4 text-emerald-500" />
                <span>{lang === 'hi' ? 'PPM, धूल कण व परिवेशी शोर सेंसर' : 'PPM, Particle & Ambient Noise Telemetry'}</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border bg-card/60 p-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>{lang === 'hi' ? 'स्मार्ट आगंतुक प्रविष्टि व प्रवेश लॉग्स' : 'Smart Visitor Fast Entry & Access Register'}</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border bg-card/60 p-2.5">
                <Building2 className="h-4 w-4 text-emerald-500" />
                <span>{lang === 'hi' ? 'कैमरा फोटो सत्यापन सहित रखरखाव प्रबंधन' : 'Direct Camera Capture & Verified Repairs'}</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            CampusGuard Secure Enterprise Edition · High Availability Multi-Zone Deployment
          </div>
        </div>

        {/* Auth Box with Create Account / Sign In Tabs */}
        <div className="flex flex-col justify-center p-6 sm:p-12">
          <div className="mx-auto w-full max-w-md space-y-6">
            <div className="lg:hidden flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold">CampusGuard</h1>
                <p className="text-xs text-muted-foreground">{t('header.subtitle')}</p>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 rounded-xl bg-muted/60 p-1 border">
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null) }}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all',
                  mode === 'signin'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <LogIn className="h-4 w-4" />
                {t('auth.signin')}
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null) }}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all',
                  mode === 'signup'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <UserPlus className="h-4 w-4" />
                {t('auth.create_account')}
              </button>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {mode === 'signin' ? t('auth.signin') : t('auth.create_account')}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === 'signin'
                  ? (lang === 'hi' ? 'अपने क्रेडेंशियल्स दर्ज करके कमांड सेंटर में प्रवेश करें।' : 'Enter your credentials to access the safety command center.')
                  : (lang === 'hi' ? 'छात्र, शिक्षक, सुरक्षा या रखरखाव दल के लिए नया खाता बनाएं।' : 'Register a new account for student, staff, security or facilities.')}
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
                <span>{lang === 'hi' ? 'सफल! डैशबोर्ड लोड हो रहा है…' : 'Success! Loading your security dashboard…'}</span>
              </div>
            )}

            {/* SIGN IN FORM */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="username" className="text-sm font-medium">
                    {t('auth.username')}
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      ref={usernameRef}
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      placeholder="e.g. admin or aarav"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setError(null) }}
                      disabled={submitting || success}
                      className="w-full h-11 rounded-lg border bg-card pl-10 pr-3 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium">
                    {t('auth.password')}
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null) }}
                      disabled={submitting || success}
                      className="w-full h-11 rounded-lg border bg-card pl-10 pr-11 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || success}
                  className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-60"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {lang === 'hi' ? 'सत्यापित हो रहा है…' : 'Verifying credentials…'}</>
                  ) : (
                    <><LogIn className="h-4 w-4" /> {t('auth.btn_signin')}</>
                  )}
                </button>
              </form>
            )}

            {/* CREATE ACCOUNT / SIGN UP FORM */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-3.5" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="reg-name" className="text-sm font-medium">
                    {t('auth.fullname')} *
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="reg-name"
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setError(null) }}
                      className="w-full h-10 rounded-lg border bg-card pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="reg-user" className="text-sm font-medium">
                      {t('auth.username')} *
                    </label>
                    <input
                      id="reg-user"
                      type="text"
                      placeholder="e.g. rahul24"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setError(null) }}
                      className="w-full h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="reg-role" className="text-sm font-medium">
                      {t('auth.role')} *
                    </label>
                    <select
                      id="reg-role"
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as any)}
                      className="w-full h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:border-emerald-500"
                    >
                      <option value="STUDENT">Student (छात्र)</option>
                      <option value="STAFF">Faculty / Staff (कर्मचारी)</option>
                      <option value="MAINTENANCE">Maintenance (तकनीशियन)</option>
                      <option value="SECURITY">Campus Security (सुरक्षा दल)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reg-email" className="text-sm font-medium">
                    {t('auth.email')} *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="reg-email"
                      type="email"
                      placeholder="e.g. rahul@campus.edu"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(null) }}
                      className="w-full h-10 rounded-lg border bg-card pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="reg-dept" className="text-sm font-medium">
                      {t('auth.dept')}
                    </label>
                    <input
                      id="reg-dept"
                      type="text"
                      placeholder="e.g. CSE Year 2"
                      value={dept}
                      onChange={(e) => setDept(e.target.value)}
                      className="w-full h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="reg-pwd" className="text-sm font-medium">
                      {t('auth.password')} *
                    </label>
                    <input
                      id="reg-pwd"
                      type="password"
                      placeholder="Min 6 chars"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null) }}
                      className="w-full h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || success}
                  className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-60"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {lang === 'hi' ? 'खाता तैयार हो रहा है…' : 'Creating your account…'}</>
                  ) : (
                    <><UserPlus className="h-4 w-4" /> {t('auth.btn_create')}</>
                  )}
                </button>
              </form>
            )}

            {/* Demo accounts helper */}
            <div className="rounded-xl border bg-card/60 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAccounts((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium hover:bg-accent/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  {t('auth.demo_helper')}
                </span>
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', showAccounts && 'rotate-180')} />
              </button>
              {showAccounts && (
                <div className="border-t divide-y text-xs">
                  {accounts?.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => fillDemo(u)}
                      className="w-full text-left px-4 py-2 flex items-center justify-between hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-[10px]"
                          style={{ backgroundColor: u.color }}
                        >
                          {ROLE_ICONS[u.role as Role]}
                        </span>
                        <div>
                          <p className="font-semibold">{u.name} <span className="font-normal opacity-70">({u.role})</span></p>
                          <p className="text-[11px] text-muted-foreground font-mono">{u.username} · {DEMO_PASSWORDS[u.username]}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Fill →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
