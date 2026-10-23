import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { can, type Role } from '@/lib/permissions'
import { startSimSupervisor } from '@/lib/sim-supervisor'
import { verifyToken } from '@/lib/password'

export { can }
export type { Role }

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  dept: string | null
  color: string
  phone?: string | null
  warningCount?: number
  isSuspended?: boolean
  suspendedAt?: string | null
  suspensionReason?: string | null
  isVerified?: boolean
  rollNumber?: string | null
}

export async function getUser(req: NextRequest): Promise<SessionUser | null> {
  // Lazily boot the simulation-service watchdog on first API traffic
  startSimSupervisor()
  const auth = req.headers.get('authorization')
  const token = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
  const id = verifyToken(token)
  if (!id) return null
  const user = await db.user.findUnique({ where: { id } })
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    dept: user.dept,
    color: user.color,
    phone: user.phone ?? null,
    warningCount: user.warningCount ?? 0,
    isSuspended: user.isSuspended ?? false,
    suspendedAt: user.suspendedAt ? user.suspendedAt.toISOString() : null,
    suspensionReason: user.suspensionReason ?? null,
    isVerified: user.isVerified ?? false,
    rollNumber: user.rollNumber ?? null,
  }
}

export function unauthorized() {
  return Response.json({ error: 'Sign in required' }, { status: 401 })
}

export function forbidden() {
  return Response.json({ error: 'Your role does not permit this action' }, { status: 403 })
}

