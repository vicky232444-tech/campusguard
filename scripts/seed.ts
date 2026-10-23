/**
 * Seed script — CampusGuard (TechTrix'26 Project 8)
 * Creates demo users, sensors, historical readings, security events,
 * visitor logs, maintenance reports and alerts.
 */
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import { hashPassword } from '../src/lib/password'

const db = new PrismaClient()

const MIN = 60 * 1000
const now = Date.now()
const ago = (mins: number) => new Date(now - mins * MIN)

/** Generates a labeled placeholder JPEG (demo photo) as a data URL. */
async function placeholder(label: string, bg: string): Promise<string> {
  const svg = Buffer.from(
    `<svg width="640" height="400" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="640" height="400" fill="${bg}"/>` +
    `<rect x="24" y="24" width="592" height="352" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" stroke-dasharray="10 8"/>` +
    `<text x="50%" y="48%" font-size="36" fill="white" text-anchor="middle" font-family="sans-serif" font-weight="bold">${label}</text>` +
    `<text x="50%" y="58%" font-size="18" fill="rgba(255,255,255,0.75)" text-anchor="middle" font-family="sans-serif">demo placeholder photo</text>` +
    `</svg>`,
  )
  const buf = await sharp(svg).jpeg({ quality: 70 }).toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

async function main() {
  console.log('Clearing existing data...')
  await db.fine.deleteMany()
  await db.reportUpdate.deleteMany()
  await db.maintenanceReport.deleteMany()
  await db.sosAlert.deleteMany()
  await db.alert.deleteMany()
  await db.securityEvent.deleteMany()
  await db.visitorLog.deleteMany()
  await db.sensorReading.deleteMany()
  await db.sensor.deleteMany()
  await db.user.deleteMany()

  // ─── Users (one per role, each with individual username + password) ───────
  console.log('Seeding users...')
  const aarav = await db.user.create({
    data: {
      name: 'Aarav Sharma', username: 'aarav', email: 'aarav@campus.edu',
      password: hashPassword('aarav123'),
      role: 'STUDENT', dept: 'CSE · Year 1', color: '#10b981',
    },
  })
  const priya = await db.user.create({
    data: {
      name: 'Priya Nair', username: 'priya', email: 'priya@campus.edu',
      password: hashPassword('priya123'),
      role: 'STAFF', dept: 'Faculty · CS Dept', color: '#14b8a6',
    },
  })
  const vikram = await db.user.create({
    data: {
      name: 'Vikram Singh', username: 'vikram', email: 'vikram@campus.edu',
      password: hashPassword('vikram123'),
      role: 'SECURITY', dept: 'Campus Security', color: '#f59e0b',
    },
  })
  const meera = await db.user.create({
    data: {
      name: 'Meera Krishnan', username: 'meera', email: 'meera@campus.edu',
      password: hashPassword('meera123'),
      role: 'MAINTENANCE', dept: 'Facilities Team', color: '#8b5cf6',
    },
  })
  await db.user.create({
    data: {
      name: 'Dr. Anil Rao', username: 'admin', email: 'rao@campus.edu',
      password: hashPassword('admin123'),
      role: 'ADMIN', dept: 'Building Administrator', color: '#ef4444',
    },
  })

  // ─── Sensors ───────────────────────────────────────────────────────────────
  console.log('Seeding sensors...')
  const sensorDefs = [
    { code: 'TEMP-A201', name: 'Classroom Temperature', type: 'TEMPERATURE', zone: 'Academic Block A', location: 'Room 201', unit: '°C', minThreshold: 16, maxThreshold: 30, baseline: 24 },
    { code: 'SMOKE-A1C', name: 'Corridor Smoke Detector', type: 'SMOKE', zone: 'Academic Block A', location: 'Floor 1 Corridor', unit: 'ppm', minThreshold: 0, maxThreshold: 55, baseline: 9 },
    { code: 'GAS-KITCH', name: 'LPG Leakage Sensor', type: 'GAS', zone: 'Cafeteria', location: 'Kitchen', unit: 'ppm', minThreshold: 0, maxThreshold: 180, baseline: 24 },
    { code: 'WATER-TA', name: 'Overhead Tank Level', type: 'WATER_LEVEL', zone: 'Utility Block', location: 'Rooftop Tank A', unit: '%', minThreshold: 25, maxThreshold: 95, baseline: 68 },
    { code: 'PWR-PANEL', name: 'Main Panel Power Load', type: 'POWER_LOAD', zone: 'Utility Block', location: 'Main Electrical Panel', unit: 'kW', minThreshold: 10, maxThreshold: 85, baseline: 52 },
    { code: 'AQI-LIB', name: 'Air Quality Index', type: 'AIR_QUALITY', zone: 'Library', location: 'Reading Hall', unit: 'AQI', minThreshold: 20, maxThreshold: 180, baseline: 55 },
    { code: 'VIB-PUMP', name: 'Pump Vibration', type: 'VIBRATION', zone: 'Utility Block', location: 'Basement Pump Room', unit: 'mm/s', minThreshold: 0, maxThreshold: 7, baseline: 2.2 },
    { code: 'HUM-REC', name: 'Records Room Humidity', type: 'HUMIDITY', zone: 'Admin Block', location: 'Records Room', unit: '%', minThreshold: 35, maxThreshold: 65, baseline: 48 },
  ]

  const sensors: Record<string, string> = {}
  for (const def of sensorDefs) {
    const s = await db.sensor.create({ data: def })
    sensors[def.code] = s.id
  }

  // ─── Historical readings (last 2 hours, every 5 min) ──────────────────────
  console.log('Seeding historical readings...')
  const noise = (amp: number) => (Math.random() - 0.5) * 2 * amp
  for (const def of sensorDefs) {
    const rows: { sensorId: string; value: number; isAnomaly: boolean; createdAt: Date }[] = []
    for (let i = 24; i >= 0; i--) {
      const t = ago(i * 5)
      let value = def.baseline + noise(def.baseline * 0.06)
      let isAnomaly = false
      // scripted anomaly: smoke spike ~85 min ago, AQI bump ~45 min ago
      if (def.code === 'SMOKE-A1C' && i === 17) { value = 78; isAnomaly = true }
      if (def.code === 'SMOKE-A1C' && i === 16) { value = 61; isAnomaly = true }
      if (def.code === 'AQI-LIB' && i === 9) { value = 195; isAnomaly = true }
      if (value < def.minThreshold || value > def.maxThreshold) isAnomaly = true
      rows.push({ sensorId: sensors[def.code], value: Math.round(value * 10) / 10, isAnomaly, createdAt: t })
    }
    await db.sensorReading.createMany({ data: rows })
    const last = rows[rows.length - 1]
    await db.sensor.update({
      where: { id: sensors[def.code] },
      data: { lastValue: last.value, lastStatus: last.isAnomaly ? 'WARNING' : 'NORMAL' },
    })
  }

  // ─── Security events (last 24 h) ───────────────────────────────────────────
  console.log('Seeding security events...')
  const secDefs: { zone: string; area: string; personName: string; credential: string; eventType: string; detail?: string; isSuspicious?: boolean; minsAgo: number }[] = [
    { zone: 'Main Gate & Perimeter', area: 'Main Gate', personName: 'Priya Nair', credential: 'KEYCARD-0102', eventType: 'ACCESS_GRANTED', minsAgo: 1420 },
    { zone: 'Academic Block A', area: 'Block A Entrance', personName: 'Aarav Sharma', credential: 'ID-STU-2291', eventType: 'ACCESS_GRANTED', minsAgo: 1380 },
    { zone: 'Admin Block', area: 'Server Room', personName: 'Unknown Person', credential: 'KEYCARD-XXXX', eventType: 'ACCESS_DENIED', detail: 'Invalid keycard presented twice', isSuspicious: true, minsAgo: 1310 },
    { zone: 'Admin Block', area: 'Server Room', personName: 'Ravi Deshpande', credential: 'KEYCARD-0451', eventType: 'ACCESS_GRANTED', detail: 'Authorized IT admin', minsAgo: 1305 },
    { zone: 'Academic Block B', area: 'Chemistry Lab Store', personName: 'Dr. Kavita Menon', credential: 'KEYCARD-0333', eventType: 'ACCESS_GRANTED', minsAgo: 1150 },
    { zone: 'Academic Block B', area: 'Chemistry Lab Store', personName: 'Rohit Das (Student)', credential: 'ID-STU-2310', eventType: 'ACCESS_DENIED', detail: 'Student credential — restricted zone', isSuspicious: true, minsAgo: 1140 },
    { zone: 'Library', area: 'Main Entrance', personName: 'Ananya Iyer', credential: 'ID-STU-2214', eventType: 'ACCESS_GRANTED', minsAgo: 1000 },
    { zone: 'Admin Block', area: 'Examination Cell', personName: 'Mr. Sharma (Staff)', credential: 'KEYCARD-0214', eventType: 'ACCESS_GRANTED', minsAgo: 940 },
    { zone: 'Main Gate & Perimeter', area: 'Vehicle Gate', personName: 'SwiftCouriers Delivery', credential: 'VISITOR-PASS-77', eventType: 'ACCESS_GRANTED', detail: 'Delivery verified at front desk', minsAgo: 880 },
    { zone: 'Academic Block A', area: 'Rooftop Access', personName: 'Unknown Person', credential: '—', eventType: 'TAILGATING', detail: 'Two people entered with single badge swipe', isSuspicious: true, minsAgo: 610 },
    { zone: 'Academic Block B', area: 'Block B Entrance', personName: 'Meera Krishnan', credential: 'KEYCARD-0288', eventType: 'ACCESS_GRANTED', minsAgo: 520 },
    { zone: 'Admin Block', area: 'Examination Cell', personName: 'Unknown Person', credential: 'KEYCARD-0917', eventType: 'ACCESS_DENIED', detail: 'Credential expired', isSuspicious: true, minsAgo: 430 },
    { zone: 'Cafeteria', area: 'Store Room', personName: 'Kitchen Staff — Salim', credential: 'KEYCARD-0611', eventType: 'ACCESS_GRANTED', minsAgo: 380 },
    { zone: 'Main Gate & Perimeter', area: 'Main Gate', personName: 'Dr. Anil Rao', credential: 'KEYCARD-0001', eventType: 'ACCESS_GRANTED', minsAgo: 300 },
    { zone: 'Academic Block A', area: 'Block A Entrance', personName: 'Maintenance — Suresh', credential: 'KEYCARD-0302', eventType: 'ACCESS_GRANTED', minsAgo: 260 },
    { zone: 'Admin Block', area: 'Server Room', personName: 'Unknown Person', credential: 'KEYCARD-XXXX', eventType: 'AFTER_HOURS', detail: 'Door opened 9:42 PM — outside allowed hours', isSuspicious: true, minsAgo: 175 },
    { zone: 'Library', area: 'Main Entrance', personName: 'Vikram Singh', credential: 'KEYCARD-0150', eventType: 'ACCESS_GRANTED', detail: 'Night patrol check', minsAgo: 150 },
    { zone: 'Academic Block B', area: 'Chemistry Lab Store', personName: 'Dr. Kavita Menon', credential: 'KEYCARD-0333', eventType: 'DOOR_HELD_OPEN', detail: 'Door propped open for 4 min', isSuspicious: true, minsAgo: 95 },
    { zone: 'Main Gate & Perimeter', area: 'Main Gate', personName: 'Sneha Pillai', credential: 'ID-STU-2302', eventType: 'ACCESS_GRANTED', minsAgo: 60 },
    { zone: 'Academic Block A', area: 'Block A Entrance', personName: 'Priya Nair', credential: 'KEYCARD-0102', eventType: 'ACCESS_GRANTED', minsAgo: 35 },
    { zone: 'Utility Block', area: 'Panel Room', personName: 'Meera Krishnan', credential: 'KEYCARD-0288', eventType: 'ACCESS_GRANTED', detail: 'Inspection round', minsAgo: 18 },
  ]
  for (const e of secDefs) {
    await db.securityEvent.create({
      data: {
        zone: e.zone, area: e.area, personName: e.personName, credential: e.credential,
        eventType: e.eventType, detail: e.detail ?? null, isSuspicious: e.isSuspicious ?? false,
        isSimulated: true, createdAt: ago(e.minsAgo),
      },
    })
  }

  // ─── Visitors ──────────────────────────────────────────────────────────────
  console.log('Seeding visitor logs...')
  await db.visitorLog.createMany({
    data: [
      { visitorName: 'Ramesh Gupta', phone: '+91 98470 11223', purpose: 'AC repair quotation', hostName: 'Dr. Anil Rao', zone: 'Admin Block', passNo: 'VP-1041', checkInAt: ago(190), checkOutAt: ago(160), status: 'CHECKED_OUT' },
      { visitorName: 'Lakshmi Textbooks Pvt Ltd', phone: '+91 90000 55441', purpose: 'Library book delivery', hostName: 'Library Office', zone: 'Library', passNo: 'VP-1042', checkInAt: ago(150), checkOutAt: ago(120), status: 'CHECKED_OUT' },
      { visitorName: 'Sunil Varma', phone: '+91 99820 34112', purpose: 'Parents–teacher meeting', hostName: 'Priya Nair', zone: 'Academic Block A', passNo: 'VP-1043', checkInAt: ago(80), status: 'INSIDE' },
      { visitorName: 'Deepa Rao', phone: '+91 98111 20876', purpose: 'Admission enquiry', hostName: 'Admin Office', zone: 'Admin Block', passNo: 'VP-1044', checkInAt: ago(55), status: 'INSIDE' },
      { visitorName: 'FireSafe Engineering', phone: '+91 90330 77120', purpose: 'Extinguisher inspection', hostName: 'Meera Krishnan', zone: 'Utility Block', passNo: 'VP-1045', checkInAt: ago(25), status: 'INSIDE' },
      { visitorName: 'Kiran Patil', phone: '+91 97010 88213', purpose: 'Instrument calibration', hostName: 'Dr. Kavita Menon', zone: 'Academic Block B', passNo: 'VP-1039', checkInAt: ago(420), checkOutAt: ago(390), status: 'CHECKED_OUT' },
    ],
  })

  // ─── SOS history ───────────────────────────────────────────────────────────
  console.log('Seeding SOS history...')
  await db.sosAlert.create({
    data: {
      triggeredById: aarav.id, triggeredBy: 'Aarav Sharma', role: 'STUDENT',
      emergencyType: 'FIRE', message: 'Scheduled fire drill — evacuation test, no real emergency.',
      shareLocation: true, locationText: 'Academic Block A', status: 'RESOLVED',
      acknowledgedBy: 'Vikram Singh', acknowledgedAt: ago(4200), resolvedBy: 'Vikram Singh', resolvedAt: ago(4160),
      createdAt: ago(4230),
    },
  })

  // ─── Maintenance reports ───────────────────────────────────────────────────
  console.log('Seeding maintenance reports...')
  const mr = async (n: number, data: Record<string, unknown>, timeline: { status: string; note?: string; by: string; minsAgo: number }[]) => {
    const r = await db.maintenanceReport.create({
      data: {
        ...data, code: `MR-${String(n).padStart(4, '0')}`,
        createdAt: ago(timeline[0].minsAgo),
      } as never,
    })
    for (const t of timeline) {
      await db.reportUpdate.create({
        data: { reportId: r.id, status: t.status, note: t.note ?? null, by: t.by, createdAt: ago(t.minsAgo) },
      })
    }
    return r
  }

  await mr(1, {
    reportedById: priya.id, reportedBy: 'Priya Nair', category: 'ELECTRICAL',
    title: 'Flickering lights in Room 105', description: 'Tube lights flicker continuously during lectures. Possible ballast issue.',
    zone: 'Academic Block A', location: 'Room 105', priority: 'HIGH', status: 'RESOLVED',
    assignedTo: 'Meera Krishnan', assignedToId: meera.id, resolvedAt: ago(215),
    adminApprovedBy: 'Dr. Anil Rao', adminApprovedAt: ago(1400),
    proofMedia: await placeholder('PROOF — After repair', '#0e7490'),
    proofNote: 'Replaced both ballasts and tested the circuit for 30 minutes — stable.',
    proofUploadedAt: ago(230),
    aiAuthenticity: 'AUTHENTIC', aiTamperScore: 8,
    aiAuthenticityNote: 'No manipulation artifacts detected; scene, lighting and fixture consistent with the described repair.',
    userConfirmMedia: await placeholder('CONFIRMED — Fixed', '#047857'),
    userConfirmNote: 'Lights are stable now, no more flickering during class.',
    userConfirmAt: ago(220),
    aiMatchVerdict: 'MATCHED', aiMatchScore: 88,
    aiMatchNote: 'Same ceiling fixture and tube lights visible in both photos; fix state consistent.',
    finalVerdictBy: 'Dr. Anil Rao', finalVerdictAt: ago(215),
  }, [
    { status: 'PENDING', by: 'Priya Nair', minsAgo: 1440 },
    { status: 'APPROVED', note: 'Verified on inspection — forwarded to facilities', by: 'Dr. Anil Rao', minsAgo: 1400 },
    { status: 'IN_PROGRESS', note: 'Ballast replacement scheduled', by: 'Meera Krishnan', minsAgo: 260 },
    { status: 'PROOF_SUBMITTED', note: 'Proof photo passed the AI authenticity audit (8% tamper confidence).', by: 'AI Verification Engine', minsAgo: 230 },
    { status: 'AWAITING_ADMIN', note: "Reporter's confirmation photo MATCHED the maintenance proof (88% similarity).", by: 'AI Verification Engine', minsAgo: 220 },
    { status: 'RESOLVED', note: 'Administrator accepted the verified repair. Closed by Dr. Anil Rao.', by: 'Dr. Anil Rao', minsAgo: 215 },
  ])

  await mr(2, {
    reportedBy: 'Ananya Iyer', category: 'PLUMBING',
    title: 'Leaking tap in ground floor washroom', description: 'Wash basin tap keeps dripping; water pooling near the drain.',
    zone: 'Library', location: 'Ground floor washroom', priority: 'LOW', status: 'RESOLVED',
    assignedTo: 'Meera Krishnan', assignedToId: meera.id, resolvedAt: ago(300),
  }, [
    { status: 'PENDING', by: 'Ananya Iyer', minsAgo: 1300 },
    { status: 'IN_PROGRESS', by: 'Meera Krishnan', minsAgo: 340 },
    { status: 'RESOLVED', note: 'Washer replaced', by: 'Meera Krishnan', minsAgo: 300 },
  ])

  await mr(3, {
    reportedById: vikram.id, reportedBy: 'Vikram Singh', category: 'ELECTRICAL',
    title: 'Sparks from distribution board near lab entrance', description: 'Visible sparks and burning smell from DB panel near Block B lab entrance. Area cordoned off.',
    zone: 'Academic Block B', location: 'Lab entrance corridor', priority: 'URGENT', status: 'IN_PROGRESS',
    assignedTo: 'Meera Krishnan', assignedToId: meera.id,
  }, [
    { status: 'PENDING', by: 'Vikram Singh', minsAgo: 190 },
    { status: 'IN_PROGRESS', note: 'Main supply isolated, electrician on site', by: 'Meera Krishnan', minsAgo: 150 },
  ])

  await mr(4, {
    reportedBy: 'Ravi Deshpande', category: 'HVAC',
    title: 'AC not cooling in server room', description: 'Server room temperature rising above 28°C. Risk to equipment.',
    zone: 'Admin Block', location: 'Server Room', priority: 'HIGH', status: 'IN_PROGRESS',
    assignedTo: 'Meera Krishnan', assignedToId: meera.id,
  }, [
    { status: 'PENDING', by: 'Ravi Deshpande', minsAgo: 480 },
    { status: 'IN_PROGRESS', note: 'Gas top-up arranged with vendor', by: 'Meera Krishnan', minsAgo: 400 },
  ])

  await mr(5, {
    reportedById: priya.id, reportedBy: 'Priya Nair', category: 'FURNITURE',
    title: 'Broken benches in classroom 203', description: 'Three benches have broken seats near the window row.',
    zone: 'Academic Block A', location: 'Room 203', priority: 'MEDIUM', status: 'PENDING',
  }, [
    { status: 'PENDING', by: 'Priya Nair', minsAgo: 220 },
  ])

  await mr(6, {
    reportedById: aarav.id, reportedBy: 'Aarav Sharma', category: 'EQUIPMENT',
    title: 'Projector HDMI port damaged', description: 'HDMI port in Room 201 projector loose — display flickers off.',
    zone: 'Academic Block B', location: 'Lab 2', priority: 'MEDIUM', status: 'PENDING',
  }, [
    { status: 'PENDING', by: 'Aarav Sharma', minsAgo: 130 },
  ])

  await mr(7, {
    reportedBy: 'Meera Krishnan', category: 'SAFETY',
    title: 'Fire extinguisher pressure low — corridor C', description: 'Monthly inspection found pressure gauge in red zone on extinguisher C-07.',
    zone: 'Academic Block A', location: 'Floor 1 Corridor C', priority: 'HIGH', status: 'PENDING',
  }, [
    { status: 'PENDING', by: 'Meera Krishnan', minsAgo: 95 },
  ])

  await mr(8, {
    reportedBy: 'Vikram Singh', category: 'STRUCTURAL',
    title: 'Crack on boundary wall near gate', description: 'Horizontal crack ~1.5 m long on inner boundary wall after monsoon rains.',
    zone: 'Main Gate & Perimeter', location: 'East boundary wall', priority: 'LOW', status: 'RESOLVED',
    assignedTo: 'Meera Krishnan', assignedToId: meera.id, resolvedAt: ago(600),
    adminApprovedBy: 'Dr. Anil Rao', adminApprovedAt: ago(2750),
  }, [
    { status: 'PENDING', by: 'Vikram Singh', minsAgo: 2880 },
    { status: 'APPROVED', note: 'Verified & forwarded', by: 'Dr. Anil Rao', minsAgo: 2750 },
    { status: 'IN_PROGRESS', by: 'Meera Krishnan', minsAgo: 700 },
    { status: 'PROOF_SUBMITTED', note: 'Proof photo passed the AI authenticity audit (11% tamper confidence).', by: 'AI Verification Engine', minsAgo: 610 },
    { status: 'AWAITING_ADMIN', note: "Reporter's confirmation photo MATCHED the maintenance proof (84% similarity).", by: 'AI Verification Engine', minsAgo: 605 },
    { status: 'RESOLVED', note: 'Grouted and sealed by contractor — accepted by administrator', by: 'Dr. Anil Rao', minsAgo: 600 },
  ])

  // ─── 3-step verification demos ────────────────────────────────────────────────
  console.log('Seeding verification workflow demos...')

  // Awaiting the reporter's confirmation photo (step 3)
  await mr(9, {
    reportedById: aarav.id, reportedBy: 'Aarav Sharma', category: 'EQUIPMENT',
    title: 'Projector HDMI port damaged', description: 'HDMI port in Room 201 projector loose — display flickers off.',
    zone: 'Academic Block B', location: 'Lab 2', priority: 'MEDIUM', status: 'PROOF_SUBMITTED',
    assignedTo: 'Meera Krishnan', assignedToId: meera.id,
    adminApprovedBy: 'Dr. Anil Rao', adminApprovedAt: ago(100),
    proofMedia: await placeholder('PROOF — After repair', '#7c3aed'),
    proofNote: 'HDMI port re-soldered and secured; tested with two laptops.',
    proofUploadedAt: ago(65),
    aiAuthenticity: 'AUTHENTIC', aiTamperScore: 12,
    aiAuthenticityNote: 'Genuine photograph; no cloning or inpainting seams detected.',
  }, [
    { status: 'PENDING', by: 'Aarav Sharma', minsAgo: 130 },
    { status: 'APPROVED', note: 'Verified — projector is critical for labs this week', by: 'Dr. Anil Rao', minsAgo: 100 },
    { status: 'IN_PROGRESS', note: 'Port re-soldered on the bench', by: 'Meera Krishnan', minsAgo: 80 },
    { status: 'PROOF_SUBMITTED', note: 'Proof photo passed the AI authenticity audit (12% tamper confidence).', by: 'AI Verification Engine', minsAgo: 65 },
  ])

  // Ready for the administrator's final verdict (all AI checks passed)
  await mr(10, {
    reportedById: priya.id, reportedBy: 'Priya Nair', category: 'PLUMBING',
    title: 'Water cooler dispensing warm water', description: 'Ground floor water cooler runs but dispenses warm water since morning.',
    zone: 'Library', location: 'Ground floor lobby', priority: 'MEDIUM', status: 'AWAITING_ADMIN',
    assignedTo: 'Meera Krishnan', assignedToId: meera.id,
    adminApprovedBy: 'Dr. Anil Rao', adminApprovedAt: ago(300),
    proofMedia: await placeholder('PROOF — After repair', '#0e7490'),
    proofNote: 'Compressor relay and thermostat replaced; cooling verified at 9°C outlet.',
    proofUploadedAt: ago(90),
    aiAuthenticity: 'AUTHENTIC', aiTamperScore: 10,
    aiAuthenticityNote: 'Authentic photo; consistent lighting and panel alignment.',
    userConfirmMedia: await placeholder('CONFIRMED — Fixed', '#047857'),
    userConfirmNote: 'Water is properly cold now, thanks!',
    userConfirmAt: ago(80),
    aiMatchVerdict: 'MATCHED', aiMatchScore: 91,
    aiMatchNote: 'Same cooler unit, same lobby background; both photos show the repaired dispenser.',
  }, [
    { status: 'PENDING', by: 'Priya Nair', minsAgo: 360 },
    { status: 'APPROVED', note: 'Verified & forwarded', by: 'Dr. Anil Rao', minsAgo: 300 },
    { status: 'IN_PROGRESS', note: 'Cooler opened, relay ordered from store', by: 'Meera Krishnan', minsAgo: 150 },
    { status: 'PROOF_SUBMITTED', note: 'Proof photo passed the AI authenticity audit (10% tamper confidence).', by: 'AI Verification Engine', minsAgo: 90 },
    { status: 'AWAITING_ADMIN', note: "Reporter's confirmation photo MATCHED the maintenance proof (91% similarity) — awaiting final administrator decision.", by: 'AI Verification Engine', minsAgo: 80 },
  ])

  // Rejected by the AI — morphed proof upload + automatic fine
  const mr11 = await mr(11, {
    reportedById: vikram.id, reportedBy: 'Vikram Singh', category: 'SAFETY',
    title: 'Emergency exit sign not illuminated — Block B stairwell', description: 'Exit sign above the Block B stairwell door is dark during the night drill.',
    zone: 'Academic Block B', location: 'Stairwell exit', priority: 'HIGH', status: 'REJECTED',
    assignedTo: 'Meera Krishnan', assignedToId: meera.id,
    adminApprovedBy: 'Dr. Anil Rao', adminApprovedAt: ago(240),
    proofMedia: await placeholder('PROOF — After repair', '#b91c1c'),
    proofNote: 'Replaced the LED module and battery backup.',
    proofUploadedAt: ago(120),
    aiAuthenticity: 'MORPHED', aiTamperScore: 86,
    aiAuthenticityNote: 'Cloned regions and inconsistent shadow direction around the sign indicate digital manipulation.',
    reworkCount: 1,
  }, [
    { status: 'PENDING', by: 'Vikram Singh', minsAgo: 280 },
    { status: 'APPROVED', note: 'Safety-critical — verify quickly', by: 'Dr. Anil Rao', minsAgo: 240 },
    { status: 'IN_PROGRESS', note: 'Sign opened, module being replaced', by: 'Meera Krishnan', minsAgo: 180 },
    { status: 'REJECTED', note: 'AI rejected the proof upload — manipulated image detected (86% tamper confidence). Fine of ₹2000 issued to Meera Krishnan.', by: 'AI Verification Engine', minsAgo: 120 },
  ])
  await db.fine.create({
    data: {
      reportId: mr11.id,
      reportCode: 'MR-0011',
      finedTo: 'Meera Krishnan',
      finedToId: meera.id,
      amount: 2000,
      reason: 'AI verification detected a morphed/manipulated proof photo (tamper confidence 86%): Cloned regions and inconsistent shadow direction around the sign indicate digital manipulation.',
      status: 'ISSUED',
      issuedBy: 'AI Verification Engine',
      createdAt: ago(120),
    },
  })

  // ─── Alerts ────────────────────────────────────────────────────────────────
  console.log('Seeding alerts...')
  await db.alert.createMany({
    data: [
      { type: 'SENSOR', severity: 'HIGH', title: 'Smoke spike detected', message: 'SMOKE-A1C read 78 ppm (limit 55) in Academic Block A · Floor 1 Corridor.', zone: 'Academic Block A', sourceType: 'Sensor', sourceId: sensors['SMOKE-A1C'], status: 'RESOLVED', resolvedBy: 'system-auto', resolvedAt: ago(75), createdAt: ago(85) },
      { type: 'SENSOR', severity: 'MEDIUM', title: 'Air quality above safe limit', message: 'AQI-LIB read 195 AQI (limit 180) in Library · Reading Hall.', zone: 'Library', sourceType: 'Sensor', sourceId: sensors['AQI-LIB'], status: 'RESOLVED', resolvedBy: 'system-auto', resolvedAt: ago(38), createdAt: ago(45) },
      { type: 'SECURITY', severity: 'MEDIUM', title: 'Door held open — Chemistry Lab Store', message: 'Door propped open for 4 min at Academic Block B · Chemistry Lab Store.', zone: 'Academic Block B', status: 'ACTIVE', createdAt: ago(95) },
      { type: 'MAINTENANCE', severity: 'CRITICAL', title: 'URGENT fault reported', message: 'MR-0003 — Sparks from distribution board near lab entrance (Academic Block B).', zone: 'Academic Block B', sourceType: 'MaintenanceReport', status: 'ACKNOWLEDGED', acknowledgedBy: 'Dr. Anil Rao', acknowledgedAt: ago(180), createdAt: ago(190) },
      { type: 'MAINTENANCE', severity: 'HIGH', title: 'AI rejected morphed proof — fine issued (MR-0011)', message: 'Proof photo for MR-0011 — "Emergency exit sign not illuminated" failed the AI authenticity audit (86% tamper confidence). Work rejected; ₹2000 fine issued to Meera Krishnan.', zone: 'Academic Block B', sourceType: 'MaintenanceReport', status: 'ACTIVE', createdAt: ago(120) },
    ],
  })

  const counts = {
    users: await db.user.count(),
    sensors: await db.sensor.count(),
    readings: await db.sensorReading.count(),
    securityEvents: await db.securityEvent.count(),
    visitors: await db.visitorLog.count(),
    sos: await db.sosAlert.count(),
    reports: await db.maintenanceReport.count(),
    fines: await db.fine.count(),
    alerts: await db.alert.count(),
  }
  console.log('Seed complete:', JSON.stringify(counts))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
