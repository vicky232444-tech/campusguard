import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function resolveDatabaseUrl(): string {
  // If explicitly given an existing absolute path, use it
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
    const filePath = process.env.DATABASE_URL.replace(/^file:/, '')
    if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
      return process.env.DATABASE_URL
    }
  }

  // Candidate paths where custom.db might reside depending on working directory
  const candidates = [
    '/app/db/custom.db',
    path.resolve(process.cwd(), 'db/custom.db'),
    path.resolve(process.cwd(), '../db/custom.db'),
    path.resolve(process.cwd(), '../../db/custom.db'),
    path.resolve(__dirname, '../../db/custom.db'),
    path.resolve(__dirname, '../../../db/custom.db'),
  ]

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return `file:${path.resolve(candidate)}`
      }
    } catch {
      // ignore
    }
  }

  return process.env.DATABASE_URL || 'file:../db/custom.db'
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
