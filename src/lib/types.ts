export type Role = 'USER' | 'STUDENT' | 'SECURITY' | 'MAINTENANCE' | 'ADMIN'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  dept: string | null
  rollNumber?: string | null
  isVerified?: boolean
  color: string
  phone?: string | null
  warningCount?: number
  lastWarningAt?: string | null
  isSuspended?: boolean
  suspendedAt?: string | null
  suspensionReason?: string | null
}

export type Sensor = {
  id: string
  code: string
  name: string
  type: string
  zone: string
  location: string
  unit: string
  minThreshold: number
  maxThreshold: number
  baseline: number
  lastValue: number | null
  lastStatus: string
  updatedAt: string
}

export type SensorReading = {
  id: string
  sensorId: string
  value: number
  isAnomaly: boolean
  createdAt: string
}

export type Alert = {
  id: string
  type: 'SENSOR' | 'SECURITY' | 'SOS' | 'MAINTENANCE'
  severity: 'INFO' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  message: string
  zone: string | null
  sourceType: string | null
  sourceId: string | null
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
}

export type SecurityEvent = {
  id: string
  zone: string
  area: string
  personName: string
  credential: string
  eventType: 'ACCESS_GRANTED' | 'ACCESS_DENIED' | 'TAILGATING' | 'AFTER_HOURS' | 'DOOR_HELD_OPEN'
  detail: string | null
  isSuspicious: boolean
  isSimulated: boolean
  createdAt: string
}

export type VisitorLog = {
  id: string
  visitorName: string
  phone: string | null
  purpose: string
  hostName: string
  zone: string | null
  passNo: string
  checkInAt: string
  checkOutAt: string | null
  status: 'INSIDE' | 'CHECKED_OUT'
}

export type SosAlert = {
  id: string
  triggeredById: string | null
  triggeredBy: string
  role: string
  emergencyType: 'MEDICAL' | 'FIRE' | 'SECURITY_THREAT' | 'ACCIDENT' | 'OTHER'
  message: string | null
  shareLocation: boolean
  latitude: number | null
  longitude: number | null
  locationText: string | null
  isMassBroadcast?: boolean
  triggerSource?: 'MANUAL_ADMIN' | 'MANUAL_USER' | 'APPROVED_REQUEST' | 'AUTO_DISASTER'
  requestId?: string | null
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
}

export type SosBroadcastRequest = {
  id: string
  requestedById: string
  requestedByName: string
  requestedRole: string
  emergencyType: string
  zone: string | null
  reason: string
  targetAudience: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewedBy: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

export type StudentVerification = {
  id: string
  userId: string | null
  studentName: string
  rollNumber: string
  department: string
  yearOfStudy: string
  contactPhone: string | null
  hostelRoom: string | null
  idCardPhoto: string | null
  facePhoto: string | null
  status: 'PENDING' | 'VERIFIED' | 'REJECTED'
  aiConfidenceScore: number | null
  aiVerdict: string | null
  aiChecks: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  remarks: string | null
  createdAt: string
  updatedAt: string
}

export type ReportUpdate = {
  id: string
  reportId: string
  status: string
  note: string | null
  by: string
  createdAt: string
}

export type ReportStatus =
  | 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'PROOF_SUBMITTED' | 'AWAITING_ADMIN' | 'RESOLVED' | 'REJECTED'

export type Fine = {
  id: string
  reportId: string
  reportCode: string
  finedTo: string
  finedToId: string | null
  amount: number
  reason: string
  status: 'ISSUED' | 'WAIVED'
  issuedBy: string
  createdAt: string
}

export type MaintenanceReport = {
  id: string
  code: string
  reportedById: string | null
  reportedBy: string
  category: string
  title: string
  description: string
  zone: string
  location: string | null
  exactPlace?: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  photoData: string | null
  status: ReportStatus
  assignedTo: string | null
  proofType?: 'photo' | 'video' | null
  paymentMethod?: 'CASH' | 'ONLINE_QR' | null
  paymentStatus?: 'PENDING' | 'PAID' | null
  paymentTxnId?: string | null
  paymentAmount?: number | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  updates?: ReportUpdate[]
  fines?: Fine[]
  ratings?: WorkerRating[]
  // 3-step verification workflow
  adminApprovedBy: string | null
  adminApprovedAt: string | null
  proofMedia: string | null
  proofNote: string | null
  proofUploadedAt: string | null
  aiAuthenticity: 'AUTHENTIC' | 'MORPHED' | 'ERROR' | null
  aiTamperScore: number | null
  aiAuthenticityNote: string | null
  userConfirmMedia: string | null
  userConfirmNote: string | null
  userConfirmAt: string | null
  aiMatchVerdict: 'MATCHED' | 'MISMATCHED' | 'ERROR' | null
  aiMatchScore: number | null
  aiMatchNote: string | null
  finalVerdictBy: string | null
  finalVerdictAt: string | null
  reworkCount: number
}

export type WorkerRating = {
  id: string
  reportId: string
  reportCode: string
  userId: string
  userName: string
  userPhone: string
  workerName: string
  workerCategory: string
  stars: number
  feedback: string
  workQualityScore: number
  timelinessScore: number
  cleanlinessScore: number
  phoneConsentGiven: boolean
  status: 'PENDING_ADMIN_REVIEW' | 'CALL_VERIFIED' | 'APPROVED' | 'REJECTED_FALSE'
  reviewedBy: string | null
  reviewedAt: string | null
  adminNotes: string | null
  rejectionReason: string | null
  verificationCallAt: string | null
  verificationCallNotes: string | null
  createdAt: string
  updatedAt: string
}

export type SuspensionAppeal = {
  id: string
  userId: string
  userName: string
  userEmail: string
  userPhone: string | null
  explanation: string
  proofMedia: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  adminNotes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export type BuildingConfig = {
  id: string
  name: string
  type: 'PUBLIC_HOSPITAL' | 'RESIDENTIAL_COLONY' | 'COMMERCIAL_COMPLEX' | 'CIVIC_PUBLIC' | 'MIXED_USE'
  address: string
  latitude: number
  longitude: number
  totalFloors: number
  mapImageUrl: string | null
  updatedBy: string | null
  updatedAt: string
}

export type LiveTick = {
  ts: string
  readings: {
    sensorId: string
    code: string
    value: number
    isAnomaly: boolean
    severity: 'NORMAL' | 'WARNING' | 'CRITICAL'
  }[]
}

export type DashboardData = {
  stats: {
    activeAlerts: number
    activeSos: number
    openRepairs: number
    urgentRepairs: number
    visitorsInside: number
    suspiciousToday: number
    sensorsOnline: number
    sensorsTotal: number
  }
  zoneStatus: {
    zone: string
    abnormalSensors: number
    totalSensors: number
    activeAlerts: number
    openRepairs: number
    status: 'NORMAL' | 'ATTENTION' | 'CRITICAL'
  }[]
  alertSeverity: { severity: string; count: number }[]
  repairStatus: { status: string; count: number }[]
  recent: {
    id: string
    kind: 'alert' | 'sos' | 'security' | 'maintenance'
    title: string
    detail: string
    severity: string
    status: string
    at: string
  }[]
}

export const BUILDING_ZONES_CONFIG: Record<string, { label: string; places: string[] }> = {
  'Residential & Inpatient Block A': {
    label: 'Residential & Inpatient Block A',
    places: ['Apartment 101 - 104', 'Apartment 201 - 204', 'Inpatient Ward 3A', 'Stairwell & Fire Exit', 'Elevator Lobby A'],
  },
  'Commercial & Diagnostic Block B': {
    label: 'Commercial & Diagnostic Block B',
    places: ['Outpatient Consultation Room', 'Pathology & Lab 102', 'Commercial Food Court', 'Pharmacy Desk', 'Corridor 2B'],
  },
  'Administrative & Executive Tower': {
    label: 'Administrative & Executive Tower',
    places: ['Main Reception Lobby', 'Boardroom & Conference Hall', 'Server Room & IT Rack', 'Management Office 401', 'Restroom 3F'],
  },
  'Central Utility & Chiller Plant': {
    label: 'Central Utility & Chiller Plant',
    places: ['HVAC Chiller Plant', 'High Voltage Substation Room', 'Water Sump & Pump House', 'Diesel Generator Room'],
  },
  'Community Hall & Recreation Wing': {
    label: 'Community Hall & Recreation Wing',
    places: ['Multi-Purpose Banquet Hall', 'Health Club & Gymnasium', 'Indoor Sports Complex', 'Library Lounge'],
  },
  'Basement & Multi-Level Parking': {
    label: 'Basement & Multi-Level Parking',
    places: ['Basement P1 (Resident Slots)', 'Basement P2 (Visitor Slots)', 'Drainage Sump Pit', 'EV Charging Bay'],
  },
  'Perimeter Gates & Security Checkpoint': {
    label: 'Perimeter Gates & Security Checkpoint',
    places: ['Main Gate 1 Checkpoint', 'Service & Cargo Gate 2', 'Security Command Cabin', 'Visitor Kiosk'],
  },
}

export const ZONES = [
  'Residential & Inpatient Block A',
  'Commercial & Diagnostic Block B',
  'Administrative & Executive Tower',
  'Central Utility & Chiller Plant',
  'Community Hall & Recreation Wing',
  'Basement & Multi-Level Parking',
  'Perimeter Gates & Security Checkpoint',
] as const

export const ROLE_LABELS: Record<Role, string> = {
  USER: 'Resident / Occupant',
  STUDENT: 'Resident / Occupant',
  SECURITY: 'Security Guard',
  MAINTENANCE: 'Maintenance Team',
  ADMIN: 'Facility Administrator',
}

export const ROLE_BLURBS: Record<Role, string> = {
  USER: 'Register complaints with exact room selection, rate technicians, and access emergency SOS.',
  STUDENT: 'Register complaints with exact room selection, rate technicians, and access emergency SOS.',
  SECURITY: 'Manage gate entries of visitors and personnel, monitor perimeter access and respond to SOS.',
  MAINTENANCE: 'Resolve assigned work orders, upload video/photo proof, and collect payment via cash/QR.',
  ADMIN: 'Full facility command: building floorplan/map configuration, sensor telemetry, and rating review.',
}
