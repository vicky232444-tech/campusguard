/**
 * Role-based permission model (client-safe; also re-used by the server).
 */
export type Role = 'USER' | 'STUDENT' | 'SECURITY' | 'MAINTENANCE' | 'ADMIN'

export const can = {
  viewSecurity: (r: Role) => ['SECURITY', 'ADMIN'].includes(r),
  manageSecurity: (r: Role) => ['SECURITY', 'ADMIN'].includes(r),
  viewMonitoring: (r: Role) => ['ADMIN'].includes(r), // Administrative users only
  broadcastMassSos: (r: Role) => ['ADMIN'].includes(r), // ONLY Admin can trigger SOS across all devices
  reviewSosRequests: (r: Role) => ['ADMIN'].includes(r), // Admin approves/rejects regular user broadcast requests
  manageStudentVerification: (r: Role) => ['ADMIN'].includes(r), // Admin verifies student records
  reviewRatings: (r: Role) => ['ADMIN'].includes(r), // Admin reviews worker ratings
  reviewAppeals: (r: Role) => ['ADMIN'].includes(r), // Admin reviews suspension appeals
  configureBuildingMap: (r: Role) => ['ADMIN'].includes(r), // Admin uploads building map & location
  ackAlert: (r: Role) => ['SECURITY', 'MAINTENANCE', 'ADMIN'].includes(r),
  resolveAlert: (r: Role) => ['SECURITY', 'MAINTENANCE', 'ADMIN'].includes(r),
  ackSos: (r: Role) => ['SECURITY', 'ADMIN'].includes(r),
  resolveSos: (r: Role) => ['SECURITY', 'ADMIN'].includes(r),
  updateReport: (r: Role) => ['MAINTENANCE', 'ADMIN'].includes(r),
  viewAllReports: (r: Role) => ['MAINTENANCE', 'ADMIN'].includes(r),
  configureThresholds: (r: Role) => ['ADMIN'].includes(r),
  // Verification workflows
  approveReport: (r: Role) => ['ADMIN'].includes(r),
  submitProof: (r: Role) => ['MAINTENANCE', 'ADMIN'].includes(r),
  giveFinalVerdict: (r: Role) => ['ADMIN'].includes(r),
  viewFines: (r: Role) => ['MAINTENANCE', 'ADMIN'].includes(r),
}
