/**
 * Password hashing helpers (server-side only).
 * Format: scrypt$<saltHex>$<hashHex> using Node's built-in scrypt — no external deps.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto'

const KEYLEN = 64

/** Hash a plaintext password into `scrypt$salt$hash` form. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(plain, salt, KEYLEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

/** Constant-time verification of a plaintext password against stored hash. */
export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const [scheme, saltHex, hashHex] = stored.split('$')
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
    const expected = Buffer.from(hashHex, 'hex')
    const actual = scryptSync(plain, Buffer.from(saltHex, 'hex'), expected.length)
    return timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

/** Demo-grade session-token signing secret (prototype — production would use env/secret manager). */
const AUTH_SECRET = process.env.AUTH_SECRET ?? 'campusguard-techtix26-demo-secret'

/** Sign a user id into an unforgeable-enough session token: `<id>.<hmac>`. */
export function signToken(userId: string): string {
  const mac = createHmac('sha256', AUTH_SECRET).update(userId).digest('hex').slice(0, 32)
  return `${userId}.${mac}`
}

/** Verify a session token and return the user id it belongs to (or null). */
export function verifyToken(token: string | null | undefined): string | null {
  if (!token) return null
  const idx = token.lastIndexOf('.')
  if (idx <= 0) return null
  const userId = token.slice(0, idx)
  const expected = signToken(userId)
  if (expected.length !== token.length) return null
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(token)
    return timingSafeEqual(a, b) ? userId : null
  } catch {
    return null
  }
}
