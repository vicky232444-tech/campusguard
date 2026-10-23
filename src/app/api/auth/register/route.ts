import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, signToken } from '@/lib/password'
import type { Role } from '@/lib/permissions'

const ROLE_COLORS: Record<string, string> = {
  USER: '#10b981',
  STUDENT: '#10b981',
  SECURITY: '#f59e0b',
  MAINTENANCE: '#8b5cf6',
  ADMIN: '#ef4444',
}

/**
 * POST /api/auth/register
 * Body: { name, username, email, password, role, dept }
 * Creates a new user in the database, hashes the password, and returns the session user + token.
 */
export async function POST(req: NextRequest) {
  let body: {
    name?: string
    username?: string
    email?: string
    password?: string
    role?: string
    dept?: string
  }

  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON request body' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const username = (body.username ?? '').trim().toLowerCase()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const role = (body.role ?? 'STUDENT').toUpperCase()
  const dept = (body.dept ?? '').trim() || 'General'

  // Validation
  if (!name || name.length < 2) {
    return Response.json({ error: 'Name must be at least 2 characters long' }, { status: 400 })
  }
  if (!username || username.length < 3) {
    return Response.json({ error: 'Username must be at least 3 characters long' }, { status: 400 })
  }
  if (!/^[a-z0-9_.-]+$/.test(username)) {
    return Response.json({ error: 'Username can only contain letters, numbers, dots, and hyphens' }, { status: 400 })
  }
  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }
  if (!password || password.length < 6) {
    return Response.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
  }

  const allowedRoles = ['USER', 'STUDENT', 'SECURITY', 'MAINTENANCE', 'ADMIN']
  const finalRole = allowedRoles.includes(role) ? role : 'STUDENT'

  try {
    // Check if username already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    })

    if (existingUser) {
      if (existingUser.username === username) {
        return Response.json({ error: 'Username is already taken. Please choose another.' }, { status: 409 })
      }
      return Response.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const hashedPassword = hashPassword(password)
    const color = ROLE_COLORS[finalRole] || '#10b981'

    const newUser = await db.user.create({
      data: {
        name,
        username,
        email,
        password: hashedPassword,
        role: finalRole,
        dept,
        color,
      },
    })

    const sessionUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role as Role,
      dept: newUser.dept,
      color: newUser.color,
    }

    return Response.json(
      {
        message: 'Account created successfully',
        user: sessionUser,
        token: signToken(newUser.id),
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Registration error:', err)
    return Response.json({ error: (err as Error).message || 'Registration failed' }, { status: 500 })
  }
}
