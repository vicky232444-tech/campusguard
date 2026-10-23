import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser, can, unauthorized, forbidden } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'
import { analyzeProofAuthenticity, fineAmountFor } from '@/lib/ai-verify'

/**
 * STEP 2 — Maintenance team uploads after-work proof (photo). The AI engine
 * immediately audits it for morphing / manipulation:
 *   - MORPHED  → report auto-REJECTED and a fine is issued to that member
 *   - AUTHENTIC → report moves to PROOF_SUBMITTED (awaiting reporter confirmation)
 * Body: { proofMedia: string (data URL), note?: string }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!can.submitProof(user.role)) return forbidden()

  const { id } = await ctx.params
  const { proofMedia, note, proofType, paymentMethod, paymentAmount, paymentTxnId } = (await req.json()) as {
    proofMedia?: string
    note?: string
    proofType?: 'photo' | 'video'
    paymentMethod?: 'CASH' | 'ONLINE_QR'
    paymentAmount?: number
    paymentTxnId?: string
  }

  if (!proofMedia || (!proofMedia.startsWith('data:image/') && !proofMedia.startsWith('data:video/'))) {
    return Response.json({ error: 'A proof photo or video is required' }, { status: 400 })
  }
  if (proofMedia.length > 5_000_000) {
    return Response.json({ error: 'Proof file too large — please upload under 5MB' }, { status: 400 })
  }

  const report = await db.maintenanceReport.findUnique({ where: { id } })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })
  if (!['IN_PROGRESS', 'APPROVED', 'PROOF_SUBMITTED'].includes(report.status)) {
    return Response.json({ error: 'Proof can only be submitted for a report that is approved / in progress' }, { status: 400 })
  }

  // ── AI morphing audit ─────────────────────────────────────────────────────
  const ai = await analyzeProofAuthenticity(proofMedia, {
    code: report.code,
    title: report.title,
    zone: report.zone,
    location: report.location,
    priority: report.priority,
  })

  if (ai.verdict === 'MORPHED') {
    // Reject the work and fine the member who uploaded the proof
    const memberName = report.assignedTo ?? user.name
    const amount = fineAmountFor(report.priority)

    const updated = await db.maintenanceReport.update({
      where: { id },
      data: {
        status: 'REJECTED',
        proofMedia,
        proofNote: note?.trim() || null,
        proofUploadedAt: new Date(),
        aiAuthenticity: ai.verdict,
        aiTamperScore: ai.tamperScore,
        aiAuthenticityNote: ai.note,
        reworkCount: { increment: 1 },
      },
    })

    const fine = await db.fine.create({
      data: {
        reportId: report.id,
        reportCode: report.code,
        finedTo: memberName,
        finedToId: report.assignedToId ?? user.id,
        amount,
        reason: `Invalid or manipulated proof photo detected: ${ai.note}`,
      },
    })

    await db.reportUpdate.create({
      data: {
        reportId: id,
        status: 'REJECTED',
        note: `Proof upload flagged and rejected — invalid image detected. Fine of ₹${amount} issued to ${memberName}.`,
        by: 'System Verification',
      },
    })

    await db.alert.create({
      data: {
        type: 'MAINTENANCE',
        severity: 'HIGH',
        title: `Manipulated proof rejected — fine issued (${report.code})`,
        message: `Proof photo for ${report.code} — "${report.title}" failed authenticity check. Work rejected; ₹${amount} fine issued to ${memberName}.`,
        zone: report.zone,
        sourceType: 'MaintenanceReport',
        sourceId: report.id,
        status: 'ACTIVE',
      },
    })

    const withUpdates = await db.maintenanceReport.findUnique({
      where: { id },
      include: { updates: { orderBy: { createdAt: 'asc' } }, fines: { orderBy: { createdAt: 'desc' } } },
    })

    await broadcast({ kind: 'maintenance:update', payload: { report: updated } })
    return Response.json({ report: withUpdates, ai, fine })
  }

  // AUTHENTIC (or AI error → manual review path, still awaiting confirmation)
  const updated = await db.maintenanceReport.update({
    where: { id },
    data: {
      status: 'PROOF_SUBMITTED',
      proofMedia,
      proofNote: note?.trim() || null,
      proofUploadedAt: new Date(),
      proofType: proofType || 'photo',
      paymentMethod: paymentMethod || null,
      paymentAmount: paymentAmount != null ? Number(paymentAmount) : null,
      paymentTxnId: paymentTxnId || null,
      paymentStatus: paymentMethod ? 'PAID' : 'PENDING',
      aiAuthenticity: ai.verdict,
      aiTamperScore: ai.tamperScore,
      aiAuthenticityNote: ai.note,
    },
  })

  await db.reportUpdate.create({
    data: {
      reportId: id,
      status: 'PROOF_SUBMITTED',
      note:
        ai.verdict === 'AUTHENTIC'
          ? `Work completion proof photo submitted. Awaiting reporter confirmation.`
          : `Proof photo submitted — flagged for manual administrator review.`,
      by: user.name,
    },
  })

  const withUpdates = await db.maintenanceReport.findUnique({
    where: { id },
    include: { updates: { orderBy: { createdAt: 'asc' } }, fines: { orderBy: { createdAt: 'desc' } } },
  })

  await broadcast({ kind: 'maintenance:update', payload: { report: updated } })
  return Response.json({ report: withUpdates, ai })
}
