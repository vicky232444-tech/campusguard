import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { startSimSupervisor } from '@/lib/sim-supervisor'

/** GET /api/auth/session — current session user, or the account list for the login helper. */
export async function GET(req: NextRequest) {
  startSimSupervisor()
  const user = await getUser(req)
  if (user) {
    return Response.json({ user })
  }
  const users = await db.user.findMany({
    select: { id: true, name: true, username: true, email: true, role: true, dept: true, color: true },
    orderBy: { createdAt: 'asc' },
  })
  return Response.json({ users })
}
