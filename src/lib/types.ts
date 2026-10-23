export type Role = 'STUDENT' | 'STAFF' | 'SECURITY' | 'MAINTENANCE' | 'ADMIN'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  dept: string | null
  rollNumber?: string | null
  isVerified?: boolean
  color: string
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
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  photoData: string | null
  status: ReportStatus
  assignedTo: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  updates?: ReportUpdate[]
  fines?: Fine[]
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

export const ZONES = [
  'Academic Block A',
  'Academic Block B',
  'Library',
  'Cafeteria',
  'Admin Block',
  'Utility Block',
  'Main Gate & Perimeter',
] as const

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Student',
  STAFF: 'Staff / Faculty',
  SECURITY: 'Security Staff',
  MAINTENANCE: 'Maintenance Team',
  ADMIN: 'Administrator',
}

export const ROLE_BLURBS: Record<Role, string> = {
  STUDENT: 'Trigger SOS, report faults with photos and follow your repair requests.',
  STAFF: 'View monitoring & security, acknowledge alerts, report issues.',
  SECURITY: 'Manage access logs & visitors, respond to SOS and security alerts.',
  MAINTENANCE: 'Track and resolve repair requests across all buildings.',
  ADMIN: 'Full command center: thresholds, alerts, incidents and analytics.',
}
