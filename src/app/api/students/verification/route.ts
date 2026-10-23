import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, forbidden } from '@/lib/auth'

/** GET /api/students/verification — list student verification records */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  // Ensure default student verification records exist for demo students if table is empty
  const count = await db.studentVerification.count()
  if (count === 0) {
    const defaultStudents = [
      {
        studentName: 'Aarav Sharma',
        rollNumber: 'CS-2024-0419',
        department: 'Computer Science & Engineering',
        yearOfStudy: '1st Year',
        hostelRoom: 'Hostel Block B - Room 204',
        contactPhone: '+91 98765-10293',
        status: 'VERIFIED',
        aiConfidenceScore: 98.4,
        aiVerdict: 'AUTHENTICATED',
        aiChecks: JSON.stringify({
          faceMatch: true,
          idCardLegit: true,
          deptEnrolled: true,
          tamperFree: true,
          biometricScore: 98.4,
        }),
        verifiedBy: 'Administrator',
        verifiedAt: new Date(Date.now() - 3600000 * 24 * 5),
        remarks: 'Direct university biometric enrollment verified.',
      },
      {
        studentName: 'Rohan Mehra',
        rollNumber: 'ME-2023-0182',
        department: 'Mechanical Engineering',
        yearOfStudy: '2nd Year',
        hostelRoom: 'Hostel Block A - Room 112',
        contactPhone: '+91 98765-20384',
        status: 'PENDING',
        aiConfidenceScore: null,
        aiVerdict: null,
        aiChecks: null,
        remarks: 'New hostel allotment submission awaiting admin verification.',
      },
      {
        studentName: 'Sneha Roy',
        rollNumber: 'EE-2024-0091',
        department: 'Electrical Engineering',
        yearOfStudy: '1st Year',
        hostelRoom: 'Hostel Block C - Room 301',
        contactPhone: '+91 98765-38492',
        status: 'PENDING',
        aiConfidenceScore: null,
        aiVerdict: null,
        aiChecks: null,
        remarks: 'Smart ID card & face scan submitted.',
      },
    ]

    for (const s of defaultStudents) {
      await db.studentVerification.create({ data: s }).catch(() => {})
    }
  }

  // If student: return their record (by matching roll or name/user id)
  if (user.role === 'STUDENT') {
    const student = await db.studentVerification.findFirst({
      where: {
        OR: [
          { userId: user.id },
          { studentName: { contains: user.name } },
        ],
      },
    })
    return Response.json({ records: student ? [student] : [] })
  }

  // Admin / Staff / Maintenance see all student records
  const records = await db.studentVerification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return Response.json({ records })
}

/** POST /api/students/verification — submit student record for verification */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const body = (await req.json()) as {
    studentName: string
    rollNumber: string
    department: string
    yearOfStudy?: string
    contactPhone?: string
    hostelRoom?: string
    idCardPhoto?: string
    facePhoto?: string
  }

  if (!body.studentName || !body.rollNumber || !body.department) {
    return Response.json({ error: 'Name, Roll Number and Department are required.' }, { status: 400 })
  }

  const existing = await db.studentVerification.findUnique({
    where: { rollNumber: body.rollNumber },
  })
  if (existing) {
    return Response.json({ error: 'A record with this roll number already exists.' }, { status: 409 })
  }

  const record = await db.studentVerification.create({
    data: {
      userId: user.role === 'STUDENT' ? user.id : null,
      studentName: body.studentName.trim(),
      rollNumber: body.rollNumber.trim().toUpperCase(),
      department: body.department.trim(),
      yearOfStudy: body.yearOfStudy || '1st Year',
      contactPhone: body.contactPhone || null,
      hostelRoom: body.hostelRoom || null,
      idCardPhoto: body.idCardPhoto || null,
      facePhoto: body.facePhoto || null,
      status: 'PENDING',
    },
  })

  return Response.json({ record }, { status: 201 })
}
