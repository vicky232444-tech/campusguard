'use client'

import type { SessionUser } from './types'

/** Client fetch helper: attaches the signed session token. */
export async function api<T = unknown>(path: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = options
  const token = typeof window !== 'undefined' ? localStorage.getItem('cg-token') : null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export function saveSession(user: SessionUser, token: string) {
  localStorage.setItem('cg-token', token)
  localStorage.setItem('cg-user', JSON.stringify(user))
}

export function loadSession(): SessionUser | null {
  if (typeof window === 'undefined') return null
  // A session is only valid together with its signed token (stale pre-token sessions → login)
  if (!localStorage.getItem('cg-token')) return null
  try {
    const raw = localStorage.getItem('cg-user')
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem('cg-token')
  localStorage.removeItem('cg-user')
}
