'use client'

import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { can } from '@/lib/permissions'
import type { MaintenanceReport } from '@/lib/types'
import { Pill, STATUS_STYLES, dateTimeStr } from '@/components/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CameraCaptureModal } from '@/components/camera-capture-modal'
import {
  BadgeCheck, BadgeX, Camera, CheckCircle2, ClipboardCheck, Gavel, HandCoins, ImageOff,
  Loader2, PlayCircle, RefreshCcw, Send, ShieldAlert, Sparkles, UserCheck, X,
} from 'lucide-react'

const CATEGORIES: Record<string, string> = {
  ELECTRICAL: 'Electrical', PLUMBING: 'Plumbing', HVAC: 'HVAC', STRUCTURAL: 'Structural',
  FURNITURE: 'Furniture', EQUIPMENT: 'Equipment', SAFETY: 'Safety / Fire',
}

const PRIORITY_CLS: Record<string, string> = {
  LOW: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  HIGH: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  URGENT: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
}

/** Downscale an image client-side so the base64 payload stays small. */
export async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.7)
}

const STEPS = [
  { id: 1, label: 'Admin verifies', hint: 'Administrator checks the report & forwards to maintenance' },
  { id: 2, label: 'Proof + AI audit', hint: 'Maintenance uploads after-work photo — AI detects morphing' },
  { id: 3, label: 'Reporter confirms', hint: 'Reporter uploads own photo — AI matches both' },
  { id: 4, label: 'Final verdict', hint: 'Administrator accepts or sends back for rework' },
]

function stepIndexFor(r: MaintenanceReport): number {
  switch (r.status) {
    case 'PENDING': return 0
    case 'APPROVED': case 'IN_PROGRESS': return 1
    case 'PROOF_SUBMITTED': return 2
    case 'AWAITING_ADMIN': return 3
    case 'RESOLVED': return 4
    case 'REJECTED': return 4
    default: return 0
  }
}

function WorkflowSteps({ report }: { report: MaintenanceReport }) {
  const current = stepIndexFor(report)
  const failed = report.status === 'REJECTED'
  return (
    <div className="rounded-lg border p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> 3-step verification channel</p>
        <Pill label={report.status} className={STATUS_STYLES[report.status] ?? ''} />
      </div>
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex-1">
            <div className={cn(
              'h-1.5 rounded-full transition-colors',
              failed && i === STEPS.length - 1 ? 'bg-red-500' :
              i < current ? 'bg-emerald-500' : i === current ? 'bg-amber-500' : 'bg-muted',
            )} />
            <p className={cn('mt-1 text-[9px] leading-tight', i < current ? 'text-emerald-600 dark:text-emerald-400 font-medium' : i === current ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground')}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function AiBadge({ label, ok, score, note }: { label: string; ok: boolean | null; score?: number | null; note?: string | null }) {
  return (
    <div className={cn(
      'rounded-lg border p-2.5 text-xs space-y-1',
      ok === true ? 'border-emerald-500/30 bg-emerald-500/5' : ok === false ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5',
    )}>
      <p className="flex items-center gap-1.5 font-semibold">
        <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        {label}
        {ok === true && <BadgeCheck className="h-4 w-4 text-emerald-500" />}
        {ok === false && <BadgeX className="h-4 w-4 text-red-500" />}
        {typeof score === 'number' && (
          <span className={cn('ml-auto font-mono text-[11px]', ok === false ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
            {score}%
          </span>
        )}
      </p>
      {note && <p className="text-muted-foreground leading-snug">{note}</p>}
    </div>
  )
}

function PhotoBox({ src, caption, fallback }: { src: string | null; caption: string; fallback: string }) {
  if (!src) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-center">
        <ImageOff className="mx-auto h-4 w-4 text-muted-foreground" />
        <p className="mt-1 text-[10px] text-muted-foreground">{fallback}</p>
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <img src={src} alt={caption} className="h-36 w-full object-cover" />
      <p className="border-t bg-muted/40 px-2 py-1 text-center text-[10px] font-medium text-muted-foreground">{caption}</p>
    </div>
  )
}

export function ReportDetail({
  report, onClose, onChanged,
}: {
  report: MaintenanceReport | null
  onClose: () => void
  onChanged: () => void
}) {
  const user = useUserStore((s) => s.user)
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)

  // step 1 (admin)
  const [assigneeId, setAssigneeId] = useState<string>('')
  const [approveNote, setApproveNote] = useState('')
  // rework (admin, on rejected)
  const [reassigneeId, setReassigneeId] = useState<string>('')
  const [reworkNote, setReworkNote] = useState('')
  // step 2 (maintenance)
  const [proofNote, setProofNote] = useState('')
  const [proofFile, setProofFile] = useState<{ data: string; name: string } | null>(null)
  // step 3 (reporter)
  const [confirmNote, setConfirmNote] = useState('')
  const [confirmFile, setConfirmFile] = useState<{ data: string; name: string } | null>(null)
  // final (admin)
  const [verdictNote, setVerdictNote] = useState('')

  const isAdmin = user?.role === 'ADMIN'
  const isMaint = user?.role === 'MAINTENANCE' || user?.role === 'ADMIN'
  const isReporter = !!user && !!report && (report.reportedById === user.id || report.reportedBy === user.name)

  const { data: teamData } = useQuery({
    queryKey: ['maintenance-team'],
    queryFn: () => api<{ users: { id: string; name: string; dept: string | null }[] }>('/api/users?role=MAINTENANCE'),
    enabled: !!report && isAdmin && ['PENDING', 'REJECTED'].includes(report.status),
  })

  if (!user || !report) return null

  const act = async (path: string, json: Record<string, unknown>, successMsg: string) => {
    setBusy(true)
    try {
      await api(path, { method: 'POST', json })
      toast.success(successMsg)
      onChanged()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitWithAi = async (path: string, media: string | undefined, note: string, successMsg: string) => {
    if (!media) {
      toast.error('Attach a photo first')
      return
    }
    setAiBusy(true)
    try {
      const res = await api<{ ai: { verdict: string; tamperScore?: number; score?: number; note: string } }>(path, {
        method: 'POST',
        json: { [path.endsWith('/proof') ? 'proofMedia' : 'confirmMedia']: media, note: note || undefined },
      })
      const v = res.ai?.verdict
      if (v === 'MORPHED') {
        toast.error(`AI detected a morphed photo (${res.ai.tamperScore}% tamper confidence) — work rejected & fine issued`, { duration: 10000 })
      } else if (v === 'MATCHED') {
        toast.success(`AI matched both photos (${res.ai.score}% similarity) — sent to administrator`, { duration: 8000 })
      } else if (v === 'MISMATCHED') {
        toast.warning(`AI could NOT match the photos (${res.ai.score}%) — administrator will review`, { duration: 10000 })
      } else if (v === 'AUTHENTIC') {
        toast.success(`AI audit passed (${res.ai.tamperScore}% tamper confidence) — reporter confirmation requested`, { duration: 8000 })
      } else {
        toast.info('AI could not auto-verify — flagged for manual admin review')
      }
      onChanged()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setAiBusy(false)
    }
  }

  const cat = CATEGORIES[report.category] ?? report.category
  const fine = report.fines?.[0]

  return (
    <Dialog open={!!report} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className="font-mono text-xs text-muted-foreground">{report.code}</span>
            {report.title}
            {report.reworkCount > 0 && (
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                rework ×{report.reworkCount}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <Pill label={report.status} className={STATUS_STYLES[report.status] ?? ''} />
            <Pill label={report.priority} className={PRIORITY_CLS[report.priority]} />
            <span>{cat} · {report.zone}{report.location ? ` · ${report.location}` : ''}</span>
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm leading-relaxed text-muted-foreground">{report.description}</p>

        <WorkflowSteps report={report} />

        {/* Original fault photo */}
        <PhotoBox
          src={report.photoData}
          caption="Fault photo — uploaded by reporter"
          fallback="No photo attached to the original report"
        />

        {/* ── AI verification results ── */}
        {(report.aiAuthenticity || report.aiMatchVerdict) && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              AI verification engine results
            </p>
            {report.aiAuthenticity && (
              <AiBadge
                label={`Proof authenticity — ${report.aiAuthenticity}`}
                ok={report.aiAuthenticity === 'AUTHENTIC'}
                score={report.aiTamperScore != null ? 100 - report.aiTamperScore : null}
                note={report.aiAuthenticityNote}
              />
            )}
            {report.aiMatchVerdict && (
              <AiBadge
                label={`Photo match — ${report.aiMatchVerdict}`}
                ok={report.aiMatchVerdict === 'MATCHED'}
                score={report.aiMatchScore}
                note={report.aiMatchNote}
              />
            )}
            {(report.proofMedia || report.userConfirmMedia) && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <PhotoBox src={report.proofMedia} caption="Maintenance proof photo" fallback="Proof not uploaded yet" />
                <PhotoBox src={report.userConfirmMedia} caption="Reporter confirmation photo" fallback="Confirmation not uploaded yet" />
              </div>
            )}
          </div>
        )}

        {/* ── Fine (rejected reports) ── */}
        {fine && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
              <HandCoins className="h-4 w-4" /> Fine issued — ₹{fine.amount.toLocaleString('en-IN')}
              <Pill label={fine.status} className={cn('ml-auto', STATUS_STYLES[fine.status])} />
            </p>
            <p className="text-xs text-muted-foreground">{fine.reason}</p>
            <p className="text-[10px] text-muted-foreground">Fined: {fine.finedTo} · by {fine.issuedBy} · {dateTimeStr(fine.createdAt)}</p>
            {isAdmin && fine.status === 'ISSUED' && (
              <Button
                size="sm" variant="outline" disabled={busy}
                onClick={() => act(`/api/fines/${fine.id}`, { status: 'WAIVED' }, 'Fine waived')}
                className="h-7 text-xs"
              >
                Waive fine
              </Button>
            )}
          </div>
        )}

        {/* ── Timeline ── */}
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-semibold">Full channel timeline</p>
          <ol className="space-y-2.5 max-h-44 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {report.updates?.map((u) => (
              <li key={u.id} className="flex gap-2.5">
                <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full',
                  u.by === 'AI Verification Engine' ? 'bg-purple-500'
                  : u.status === 'PENDING' ? 'bg-amber-500'
                  : u.status === 'REJECTED' ? 'bg-red-500'
                  : u.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-sky-500',
                )} />
                <div className="min-w-0">
                  <p className="text-xs font-medium">
                    {u.status.replaceAll('_', ' ')}
                    <span className="font-normal text-muted-foreground"> — {u.by}</span>
                    {u.by === 'AI Verification Engine' && (
                      <span className="ml-1.5 rounded bg-purple-500/15 px-1 py-0.5 text-[9px] font-semibold text-purple-600 dark:text-purple-400">AI</span>
                    )}
                  </p>
                  {u.note && <p className="text-xs text-muted-foreground">{u.note}</p>}
                  <p className="text-[10px] text-muted-foreground">{dateTimeStr(u.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ── STEP 1: admin verifies & forwards ── */}
        {isAdmin && report.status === 'PENDING' && (
          <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold"><UserCheck className="h-3.5 w-3.5" /> Step 1 — Verify this report &amp; forward to maintenance</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Forward to (maintenance member)</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                  <SelectContent>
                    {teamData?.users.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}{m.dept ? ` · ${m.dept}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-note" className="text-[11px] text-muted-foreground">Verification note (optional)</Label>
                <Input id="ap-note" value={approveNote} onChange={(e) => setApproveNote(e.target.value)} placeholder="e.g. Confirmed on inspection" />
              </div>
            </div>
            <Button size="sm" disabled={busy || !assigneeId} onClick={() => act(`/api/maintenance/${report.id}/approve`, { assignedToId: assigneeId, note: approveNote }, 'Report verified & forwarded to maintenance team')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Send className="h-3.5 w-3.5" /> Verify &amp; forward
            </Button>
          </div>
        )}

        {/* ── STEP 2: maintenance proof upload ── */}
        {isMaint && ['APPROVED', 'IN_PROGRESS'].includes(report.status) && (
          <div className="space-y-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold"><Camera className="h-3.5 w-3.5" /> Step 2 — Work complete? Upload proof photo for AI audit</p>
            <p className="text-[11px] text-muted-foreground">
              The AI engine will check the photo for morphing / manipulation. A manipulated upload auto-rejects the work and issues a fine.
            </p>
            {report.status === 'APPROVED' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act(`/api/maintenance/${report.id}`, { status: 'IN_PROGRESS', note: 'Repair started' }, 'Repair started')}>
                <PlayCircle className="h-3.5 w-3.5" /> Start repair
              </Button>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <ProofPicker value={proofFile} onChange={setProofFile} label="After-work proof photo * (JPG/PNG)" />
              <div className="space-y-1.5">
                <Label htmlFor="pf-note" className="text-[11px] text-muted-foreground">Work note</Label>
                <Textarea id="pf-note" rows={3} value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="e.g. Replaced ballast, tested for 30 minutes" className="text-sm" />
              </div>
            </div>
            <Button size="sm" disabled={aiBusy || !proofFile} onClick={() => submitWithAi(`/api/maintenance/${report.id}/proof`, proofFile?.data, proofNote, 'Proof submitted')} className="bg-purple-600 hover:bg-purple-700 text-white">
              {aiBusy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> AI analysing photo…</> : <><Sparkles className="h-3.5 w-3.5" /> Submit proof for AI verification</>}
            </Button>
          </div>
        )}

        {/* ── STEP 3: reporter confirmation ── */}
        {report.status === 'PROOF_SUBMITTED' && (isReporter || isAdmin) && (
          <div className="space-y-3 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold"><Camera className="h-3.5 w-3.5" /> Step 3 — {isReporter ? 'Confirm the fix with your own photo' : 'Reporter confirmation pending'}</p>
            {isReporter ? (
              <>
                <p className="text-[11px] text-muted-foreground">
                  Upload a photo of the repaired item. The AI will cross-match it with the maintenance team&apos;s proof photo before the administrator gives the final approval.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ProofPicker value={confirmFile} onChange={setConfirmFile} label="Your confirmation photo * (JPG/PNG)" />
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-note" className="text-[11px] text-muted-foreground">Your note</Label>
                    <Textarea id="cf-note" rows={3} value={confirmNote} onChange={(e) => setConfirmNote(e.target.value)} placeholder="e.g. Lights are stable now, no flickering" className="text-sm" />
                  </div>
                </div>
                <Button size="sm" disabled={aiBusy || !confirmFile} onClick={() => submitWithAi(`/api/maintenance/${report.id}/confirm`, confirmFile?.data, confirmNote, 'Confirmation submitted')} className="bg-purple-600 hover:bg-purple-700 text-white">
                  {aiBusy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> AI matching photos…</> : <><Sparkles className="h-3.5 w-3.5" /> Upload &amp; AI-match my photo</>}
                </Button>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">Waiting for {report.reportedBy} to upload a confirmation photo.</p>
            )}
          </div>
        )}

        {/* ── FINAL: admin verdict ── */}
        {isAdmin && report.status === 'AWAITING_ADMIN' && (
          <div className="space-y-3 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold"><Gavel className="h-3.5 w-3.5" /> Final decision — administrator</p>
            <p className="text-[11px] text-muted-foreground">
              AI authenticity: <b>{report.aiAuthenticity}</b> ({report.aiTamperScore != null ? `${100 - report.aiTamperScore}% genuine confidence` : 'n/a'}) ·
              Photo match: <b>{report.aiMatchVerdict}</b> ({report.aiMatchScore ?? 'n/a'}%). Review both photos above, then decide.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="v-note" className="text-[11px] text-muted-foreground">Decision note (optional)</Label>
              <Input id="v-note" value={verdictNote} onChange={(e) => setVerdictNote(e.target.value)} placeholder="e.g. Verified on site visit" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => act(`/api/maintenance/${report.id}/verdict`, { decision: 'ACCEPT', note: verdictNote }, 'Repair accepted & closed')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="h-3.5 w-3.5" /> Accept &amp; close
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act(`/api/maintenance/${report.id}/verdict`, { decision: 'REJECT', note: verdictNote }, 'Sent back for rework')}>
                <RefreshCcw className="h-3.5 w-3.5" /> Send back for rework
              </Button>
            </div>
          </div>
        )}

        {/* Waiting states */}
        {report.status === 'APPROVED' && !isMaint && (
          <p className="rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground">
            Verified by {report.adminApprovedBy} — waiting for {report.assignedTo ?? 'maintenance team'} to start the repair.
          </p>
        )}
        {report.status === 'PENDING' && !isAdmin && (
          <p className="rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground">
            Waiting for the administrator to verify this report and forward it to the maintenance team.
          </p>
        )}
        {report.status === 'REJECTED' && (
          <p className="flex items-start gap-1.5 rounded-lg bg-red-500/10 p-3 text-[11px] text-red-600 dark:text-red-400">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            The AI rejected this proof upload as morphed/manipulated. The work was auto-rejected{fine ? ` and a ₹${fine.amount.toLocaleString('en-IN')} fine was issued to ${fine.finedTo}` : ''}. The administrator may re-assign the repair.
          </p>
        )}
        {isAdmin && report.status === 'REJECTED' && (
          <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold"><RefreshCcw className="h-3.5 w-3.5" /> Re-assign for rework</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Assign to (maintenance)</Label>
                <Select value={reassigneeId} onValueChange={setReassigneeId}>
                  <SelectTrigger><SelectValue placeholder={report.assignedTo ?? 'Select member'} /></SelectTrigger>
                  <SelectContent>
                    {teamData?.users.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}{m.dept ? ` · ${m.dept}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rw-note" className="text-[11px] text-muted-foreground">Note (optional)</Label>
                <Input id="rw-note" value={reworkNote} onChange={(e) => setReworkNote(e.target.value)} placeholder="e.g. Upload a genuine photo this time" />
              </div>
            </div>
            <Button
              size="sm" variant="outline" disabled={busy}
              onClick={() => act(`/api/maintenance/${report.id}/rework`, { assignedToId: reassigneeId || undefined, note: reworkNote }, 'Report re-assigned for rework')}
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Send back to maintenance
            </Button>
          </div>
        )}
        {!isMaint && !isReporter && report.status !== 'REJECTED' && (
          <p className="rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground">
            Repair status updates are performed by the maintenance team{report.assignedTo ? ` — currently assigned to ${report.assignedTo}` : ''}.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ProofPicker({ value, onChange, label }: {
  value: { data: string; name: string } | null
  onChange: (v: { data: string; name: string } | null) => void
  label: string
}) {
  const [err, setErr] = useState(false)
  const [camOpen, setCamOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      onChange({ data: await fileToDataUrl(f), name: f.name })
      setErr(false)
    } catch {
      setErr(true)
    }
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {value ? (
        <div className="relative overflow-hidden rounded-lg border">
          <img src={value.data} alt="Selected proof preview" className="h-28 w-full object-cover" />
          <Button size="icon" variant="secondary" className="absolute right-1.5 top-1.5 h-6 w-6" onClick={() => onChange(null)} aria-label="Remove photo">
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCamOpen(true)}
            className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-colors hover:bg-emerald-500/10"
          >
            <Camera className="h-4 w-4" />
            Live Camera
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors hover:border-emerald-500/40 hover:bg-muted/50"
          >
            <Camera className="h-4 w-4" />
            Choose File
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label={label} />
      {err && <p className="text-[10px] text-red-500">Could not read that image — try another file</p>}

      <CameraCaptureModal
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onCapture={(res) => {
          onChange({ data: res.dataUrl, name: 'camera-verified-proof.jpg' })
        }}
        title="Capture Verification Proof"
      />
    </div>
  )
}
