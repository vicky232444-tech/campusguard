import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, forbidden } from '@/lib/auth'

/** GET /api/building/config — get current building & floorplan configuration */
export async function GET() {
  let config = await db.buildingConfig.findFirst({
    orderBy: { updatedAt: 'desc' },
  })

  if (!config) {
    config = await db.buildingConfig.create({
      data: {
        name: 'Metropolitan Public & Private Facility Complex',
        type: 'MIXED_USE',
        address: 'Boulevard Heights, Sector 42',
        latitude: 28.6139,
        longitude: 77.2090,
        totalFloors: 14,
        mapImageUrl: null,
      },
    })
  }

  return Response.json({ config })
}

/** POST /api/building/config — Administrative user updates building map and location */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (user.role !== 'ADMIN') {
    return forbidden('Building Monitor Access and Map upload features are available for Administrative users only.')
  }

  const body = (await req.json()) as {
    name?: string
    type?: string
    address?: string
    latitude?: number
    longitude?: number
    totalFloors?: number
    mapImageUrl?: string
  }

  let existing = await db.buildingConfig.findFirst()

  let config
  if (existing) {
    config = await db.buildingConfig.update({
      where: { id: existing.id },
      data: {
        name: body.name ?? existing.name,
        type: body.type ?? existing.type,
        address: body.address ?? existing.address,
        latitude: body.latitude != null ? Number(body.latitude) : existing.latitude,
        longitude: body.longitude != null ? Number(body.longitude) : existing.longitude,
        totalFloors: body.totalFloors != null ? Number(body.totalFloors) : existing.totalFloors,
        mapImageUrl: body.mapImageUrl ?? existing.mapImageUrl,
        updatedBy: user.name,
      },
    })
  } else {
    config = await db.buildingConfig.create({
      data: {
        name: body.name || 'Metropolitan Public & Private Facility Complex',
        type: body.type || 'MIXED_USE',
        address: body.address || 'Boulevard Heights, Sector 42',
        latitude: body.latitude != null ? Number(body.latitude) : 28.6139,
        longitude: body.longitude != null ? Number(body.longitude) : 77.2090,
        totalFloors: body.totalFloors != null ? Number(body.totalFloors) : 14,
        mapImageUrl: body.mapImageUrl || null,
        updatedBy: user.name,
      },
    })
  }

  return Response.json({ config })
}
