import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { signToken, verifyPassword } from '@/lib/password'
import { startSimSupervisor } from '@/lib/sim-supervisor'
import type { Role } from '@/lib/permissions'

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Verifies individual credentials and returns the session user + signed token.
 */
export async function POST(req: NextRequest) {
  try {
    startSimSupervisor()
  } catch (err) {
    console.warn('[login] supervisor start warning:', err)
  }

  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const username = (body.username ?? '').trim().toLowerCase()
  const password = body.password ?? ''

  if (!username || !password) {
    return Response.json({ error: 'Please enter both username and password' }, { status: 400 })
  }

  try {
    const user = await db.user.findUnique({ where: { username } })
    // Same generic message for unknown user and wrong password (no account enumeration)
    if (!user || !verifyPassword(password, user.password)) {
      return Response.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as Role,
      dept: user.dept,
      color: user.color,
    }

    return Response.json({ user: sessionUser, token: signToken(user.id) })
  } catch (err) {
    console.error('Login error:', err)
    return Response.json({ error: (err as Error).message || 'Authentication failed' }, { status: 500 })
  }
}
