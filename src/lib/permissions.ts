/**
 * Role-based permission model (client-safe; also re-used by the server).
 */
export type Role = 'STUDENT' | 'STAFF' | 'SECURITY' | 'MAINTENANCE' | 'ADMIN'

export const can = {
  viewSecurity: (r: Role) => ['STAFF', 'SECURITY', 'ADMIN'].includes(r),
  manageSecurity: (r: Role) => ['SECURITY', 'ADMIN'].includes(r),
  viewMonitoring: (r: Role) => ['STAFF', 'MAINTENANCE', 'ADMIN'].includes(r),
  broadcastMassSos: (r: Role) => ['ADMIN'].includes(r), // ONLY Admin can trigger SOS across all devices
  reviewSosRequests: (r: Role) => ['ADMIN'].includes(r), // Admin approves/rejects regular user broadcast requests
  manageStudentVerification: (r: Role) => ['ADMIN'].includes(r), // Admin verifies student records
  ackAlert: (r: Role) => ['STAFF', 'SECURITY', 'MAINTENANCE', 'ADMIN'].includes(r),
  resolveAlert: (r: Role) => ['SECURITY', 'MAINTENANCE', 'ADMIN'].includes(r),
  ackSos: (r: Role) => ['STAFF', 'SECURITY', 'MAINTENANCE', 'ADMIN'].includes(r),
  resolveSos: (r: Role) => ['SECURITY', 'ADMIN'].includes(r),
  updateReport: (r: Role) => ['MAINTENANCE', 'ADMIN'].includes(r),
  viewAllReports: (r: Role) => ['STAFF', 'SECURITY', 'MAINTENANCE', 'ADMIN'].includes(r),
  configureThresholds: (r: Role) => ['ADMIN'].includes(r),
  // 3-step verification workflow
  approveReport: (r: Role) => ['ADMIN'].includes(r), // Step 1: verify & forward
  submitProof: (r: Role) => ['MAINTENANCE', 'ADMIN'].includes(r), // Step 2: after-work proof
  giveFinalVerdict: (r: Role) => ['ADMIN'].includes(r), // Final accept / rework
  viewFines: (r: Role) => ['MAINTENANCE', 'ADMIN'].includes(r),
}
