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
  const { proofMedia, note } = (await req.json()) as { proofMedia?: string; note?: string }

  if (!proofMedia || !proofMedia.startsWith('data:image/')) {
    return Response.json({ error: 'A proof photo is required' }, { status: 400 })
  }
  if (proofMedia.length > 1_500_000) {
    return Response.json({ error: 'Photo too large — please choose a smaller image' }, { status: 400 })
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
        reason: `AI verification detected a morphed/manipulated proof photo (tamper confidence ${ai.tamperScore}%): ${ai.note}`,
      },
    })

    await db.reportUpdate.create({
      data: {
        reportId: id,
        status: 'REJECTED',
        note: `AI rejected the proof upload — manipulated image detected (${ai.tamperScore}% tamper confidence). Fine of ₹${amount} issued to ${memberName}.`,
        by: 'AI Verification Engine',
      },
    })

    await db.alert.create({
      data: {
        type: 'MAINTENANCE',
        severity: 'HIGH',
        title: `AI rejected morphed proof — fine issued (${report.code})`,
        message: `Proof photo for ${report.code} — "${report.title}" failed the AI authenticity audit (${ai.tamperScore}% tamper confidence). Work rejected; ₹${amount} fine issued to ${memberName}.`,
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
          ? `Proof photo passed the AI authenticity audit (${ai.tamperScore}% tamper confidence). ${ai.note}`
          : `Proof photo could not be auto-verified — flagged for manual admin review. ${ai.note}`,
      by: ai.verdict === 'AUTHENTIC' ? 'AI Verification Engine' : user.name,
    },
  })

  const withUpdates = await db.maintenanceReport.findUnique({
    where: { id },
    include: { updates: { orderBy: { createdAt: 'asc' } }, fines: { orderBy: { createdAt: 'desc' } } },
  })

  await broadcast({ kind: 'maintenance:update', payload: { report: updated } })
  return Response.json({ report: withUpdates, ai })
}
