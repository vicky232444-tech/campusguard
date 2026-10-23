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
  Star, QrCode, Video, Smartphone, Check,
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
  { id: 2, label: 'Technician Proof', hint: 'Maintenance uploads after-work completion proof' },
  { id: 3, label: 'Reporter confirms', hint: 'Reporter uploads photo to confirm completion' },
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
        <p className="text-xs font-semibold flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Resolution Workflow</p>
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
  const [proofType, setProofType] = useState<'photo' | 'video'>('photo')
  const [videoProof, setVideoProof] = useState<string>('')
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'ONLINE_QR'>('CASH')
  const [paymentAmount, setPaymentAmount] = useState<number>(500)
  const [txnId, setTxnId] = useState<string>(() => `TXN-${Date.now()}`)
  const [paymentPaid, setPaymentPaid] = useState<boolean>(false)

  // camera modal target ('proof' | 'confirm' | null)
  const [cameraTarget, setCameraTarget] = useState<'proof' | 'confirm' | null>(null)

  // rating modal
  const [ratingModalOpen, setRatingModalOpen] = useState(false)
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

  const submitWithAi = async (path: string, media: string | undefined, note: string, successMsg: string, extraJson?: Record<string, unknown>) => {
    if (!media) {
      toast.error('Attach proof media first')
      return
    }
    setAiBusy(true)
    try {
      const res = await api<{ ai: { verdict: string; tamperScore?: number; score?: number; note: string } }>(path, {
        method: 'POST',
        json: {
          [path.endsWith('/proof') ? 'proofMedia' : 'confirmMedia']: media,
          note: note || undefined,
          ...extraJson,
        },
      })
      const v = res.ai?.verdict
      if (v === 'MORPHED') {
        toast.error(`Proof rejected — work sent back for review`, { duration: 8000 })
      } else if (v === 'MATCHED') {
        toast.success(`Photos submitted successfully — sent to administrator for review`, { duration: 8000 })
      } else if (v === 'MISMATCHED') {
        toast.warning(`Confirmation photo submitted — sent to administrator for review`, { duration: 8000 })
      } else if (v === 'AUTHENTIC') {
        toast.success(`Proof uploaded successfully — reporter confirmation requested`, { duration: 8000 })
      } else {
        toast.info('Proof submitted — flagged for administrator review')
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
    <>
      <Dialog open={!!report} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto" onCloseAutoFocus={(e) => e.preventDefault()}>
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

        {/* Settlement / Payment Info */}
        {report.paymentMethod && (
          <div className="rounded-lg border bg-card p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <HandCoins className="h-4 w-4 text-emerald-500" />
                Payment: {report.paymentMethod === 'ONLINE_QR' ? 'Dynamic Online QR Code' : 'Cash on Delivery'}
              </span>
              <Pill label={report.paymentStatus || 'PAID'} className={STATUS_STYLES.RESOLVED} />
            </div>
            <div className="flex items-center justify-between text-muted-foreground pt-1">
              <span>Amount: ₹{(report.paymentAmount || 500).toLocaleString('en-IN')}</span>
              {report.paymentTxnId && <span className="font-mono text-[10px]">Ref: {report.paymentTxnId}</span>}
            </div>
          </div>
        )}

        {/* Rate Technician section */}
        {report.status === 'RESOLVED' && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold flex items-center gap-1.5 text-foreground">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                Rate Maintenance Technician: {report.assignedTo ?? 'Technician'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Submit user feedback with phone verification consent. Approved ratings boost worker rankings.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1 text-xs"
              onClick={() => setRatingModalOpen(true)}
            >
              <Star className="h-3.5 w-3.5 fill-white" /> Rate Technician
            </Button>
          </div>
        )}

        {/* Original fault photo */}
        <PhotoBox
          src={report.photoData}
          caption="Fault photo — uploaded by reporter"
          fallback="No photo attached to the original report"
        />

        {/* ── Work Completion Proof Photos (Without AI verification engine box) ── */}
        {(report.proofMedia || report.userConfirmMedia) && (
          <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3 shadow-xs">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Repair Work Proof &amp; Confirmation Photos
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <PhotoBox src={report.proofMedia} caption="Maintenance proof photo" fallback="Proof not uploaded yet" />
              <PhotoBox src={report.userConfirmMedia} caption="Reporter confirmation photo" fallback="Confirmation not uploaded yet" />
            </div>
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
                  u.status === 'PENDING' ? 'bg-amber-500'
                  : u.status === 'REJECTED' ? 'bg-red-500'
                  : u.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-sky-500',
                )} />
                <div className="min-w-0">
                  <p className="text-xs font-medium">
                    {String(u.status ?? '').replaceAll('_', ' ')}
                    <span className="font-normal text-muted-foreground"> — {u.by === 'AI Verification Engine' ? 'System Verification' : u.by}</span>
                  </p>
                  {u.note && (
                    <p className="text-xs text-muted-foreground">
                      {u.note
                        .replace(/AI verification detected a morphed\/manipulated proof photo/g, 'Proof rejected after review')
                        .replace(/AI rejected the proof upload/g, 'Proof rejected after review')
                        .replace(/AI /g, 'System ')
                        .replace(/AI audit/g, 'verification check')}
                    </p>
                  )}
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

        {/* ── STEP 2: maintenance proof upload & payment ── */}
        {isMaint && ['APPROVED', 'IN_PROGRESS'].includes(report.status) && (
          <div className="space-y-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Camera className="h-3.5 w-3.5" /> Step 2 — Work Complete: Proof of Work &amp; Payment
            </p>
            <p className="text-[11px] text-muted-foreground">
              Upload video/photo as proof of work. Choose payment via Cash or dynamic online QR code.
            </p>
            {report.status === 'APPROVED' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act(`/api/maintenance/${report.id}`, { status: 'IN_PROGRESS', note: 'Repair started' }, 'Repair started')}>
                <PlayCircle className="h-3.5 w-3.5" /> Start repair
              </Button>
            )}

            {/* Proof Type Toggle: Photo vs Video */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-bold text-foreground">Proof Type:</span>
              <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setProofType('photo')}
                  className={cn('px-2.5 py-1 rounded font-semibold transition-all', proofType === 'photo' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
                >
                  <Camera className="h-3 w-3 inline mr-1" /> Photo Proof
                </button>
                <button
                  type="button"
                  onClick={() => setProofType('video')}
                  className={cn('px-2.5 py-1 rounded font-semibold transition-all', proofType === 'video' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
                >
                  <Video className="h-3 w-3 inline mr-1" /> Video Proof
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {proofType === 'photo' ? (
                <ProofPicker
                  value={proofFile}
                  onChange={setProofFile}
                  label="After-work proof photo * (JPG/PNG)"
                  onLaunchCamera={() => setCameraTarget('proof')}
                />
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Video Proof File / Link *</Label>
                  <Input
                    value={videoProof}
                    onChange={(e) => setVideoProof(e.target.value)}
                    placeholder="Enter video proof data URL or media link..."
                    className="text-xs h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">Direct video capture verification enabled</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="pf-note" className="text-[11px] text-muted-foreground">Work note</Label>
                <Textarea id="pf-note" rows={3} value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="e.g. Replaced faulty component, tested on-site for 30 minutes" className="text-sm" />
              </div>
            </div>

            {/* Payment Method Section: Cash vs Newly Generated Dynamic QR Code */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <HandCoins className="h-4 w-4" /> Settlement &amp; Payment Method
                </span>
                <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CASH')}
                    className={cn('px-2.5 py-1 rounded font-semibold transition-all', paymentMode === 'CASH' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground')}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode('ONLINE_QR')
                      setTxnId(`TXN-${Date.now()}`)
                    }}
                    className={cn('px-2.5 py-1 rounded font-semibold transition-all', paymentMode === 'ONLINE_QR' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground')}
                  >
                    Dynamic Online QR
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="space-y-1 w-32">
                  <Label className="text-[11px] text-muted-foreground">Bill Amount (₹)</Label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="text-xs h-8"
                  />
                </div>
                {paymentMode === 'CASH' ? (
                  <p className="text-[11px] text-muted-foreground pt-4">
                    Cash settlement: Collect ₹{paymentAmount} directly from resident upon completion.
                  </p>
                ) : (
                  <div className="flex-1 flex flex-wrap items-center gap-3 pt-2">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`upi://pay?pa=facility.omniguard@upi&pn=BuildingFacilities&am=${paymentAmount}&tr=${txnId}`)}`}
                      alt="Fresh UPI Payment QR Code"
                      className="h-20 w-20 border rounded-lg bg-white p-1 shadow-sm shrink-0"
                    />
                    <div className="text-xs space-y-1 min-w-0">
                      <p className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <QrCode className="h-3.5 w-3.5" /> Newly Generated Dynamic QR
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">Ref: {txnId}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant={paymentPaid ? 'default' : 'outline'}
                        className={cn('h-6 text-[11px] gap-1', paymentPaid ? 'bg-emerald-600 text-white' : 'border-emerald-500/40 text-emerald-700')}
                        onClick={() => setPaymentPaid((v) => !v)}
                      >
                        <Check className="h-3 w-3" /> {paymentPaid ? 'Payment Received' : 'Mark Online Paid'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button
              size="sm"
              disabled={aiBusy || (proofType === 'photo' ? !proofFile : !videoProof)}
              onClick={() => submitWithAi(
                `/api/maintenance/${report.id}/proof`,
                proofType === 'video' ? videoProof : proofFile?.data,
                proofNote,
                'Proof submitted',
                {
                  proofType,
                  paymentMethod: paymentMode,
                  paymentAmount,
                  paymentTxnId: paymentMode === 'ONLINE_QR' ? txnId : undefined,
                  paymentStatus: paymentPaid || paymentMode === 'CASH' ? 'PAID' : 'PENDING',
                }
              )}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {aiBusy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting proof…</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Submit proof &amp; payment details</>}
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
                  Upload a photo of the repaired item to confirm that the work has been completed before the administrator reviews.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ProofPicker
                    value={confirmFile}
                    onChange={setConfirmFile}
                    label="Your confirmation photo * (JPG/PNG)"
                    onLaunchCamera={() => setCameraTarget('confirm')}
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-note" className="text-[11px] text-muted-foreground">Your note</Label>
                    <Textarea id="cf-note" rows={3} value={confirmNote} onChange={(e) => setConfirmNote(e.target.value)} placeholder="e.g. Lights are stable now, no flickering" className="text-sm" />
                  </div>
                </div>
                <Button size="sm" disabled={aiBusy || !confirmFile} onClick={() => submitWithAi(`/api/maintenance/${report.id}/confirm`, confirmFile?.data, confirmNote, 'Confirmation submitted')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {aiBusy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting confirmation…</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Upload confirmation photo</>}
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
              Review both technician proof and reporter confirmation photos above, then decide.
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
            The proof upload was rejected. The work was sent back for rework{fine ? ` and a ₹${fine.amount.toLocaleString('en-IN')} fine was issued to ${fine.finedTo}` : ''}. The administrator may re-assign the repair.
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

    {/* Sibling modals outside the parent Dialog to avoid Radix UI nested dialog crash */}
    <WorkerRatingModal
      open={ratingModalOpen}
      onClose={() => setRatingModalOpen(false)}
      report={report}
      user={user}
      onRated={() => onChanged()}
    />

    <CameraCaptureModal
      open={!!cameraTarget}
      onClose={() => setCameraTarget(null)}
      onCapture={(res) => {
        if (cameraTarget === 'proof') {
          setProofFile({ data: res.dataUrl, name: 'camera-verified-proof.jpg' })
        } else if (cameraTarget === 'confirm') {
          setConfirmFile({ data: res.dataUrl, name: 'camera-verified-confirm.jpg' })
        }
        setCameraTarget(null)
      }}
      title={cameraTarget === 'proof' ? 'Capture Work Completion Proof' : 'Capture Reporter Confirmation Photo'}
    />
  </>
  )
}

function ProofPicker({
  value,
  onChange,
  label,
  onLaunchCamera,
}: {
  value: { data: string; name: string } | null
  onChange: (v: { data: string; name: string } | null) => void
  label: string
  onLaunchCamera?: () => void
}) {
  const [err, setErr] = useState(false)
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
            onClick={() => onLaunchCamera?.()}
            className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-colors hover:bg-emerald-500/10"
          >
            <Camera className="h-4 w-4" />
            Take Photo
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
    </div>
  )
}

function WorkerRatingModal({
  open,
  onClose,
  report,
  user,
  onRated,
}: {
  open: boolean
  onClose: () => void
  report: MaintenanceReport
  user: { name: string; phone?: string | null }
  onRated: () => void
}) {
  const [stars, setStars] = useState(5)
  const [quality, setQuality] = useState(5)
  const [timeliness, setTimeliness] = useState(5)
  const [cleanliness, setCleanliness] = useState(5)
  const [phone, setPhone] = useState(user.phone || '+91 98765-43210')
  const [consent, setConsent] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submitRating = async () => {
    if (!consent) {
      toast.error('You must consent to the phone verification policy before submitting a rating.')
      return
    }
    if (!phone.trim() || phone.trim().length < 8) {
      toast.error('Please enter a valid phone number for administrative verification.')
      return
    }
    setSubmitting(true)
    try {
      await api('/api/ratings', {
        method: 'POST',
        json: {
          reportId: report.id,
          workerName: report.assignedTo || 'Assigned Technician',
          workerCategory: report.category,
          stars,
          feedback: feedback.trim(),
          workQualityScore: quality,
          timelinessScore: timeliness,
          cleanlinessScore: cleanliness,
          userPhone: phone.trim(),
          phoneConsentGiven: consent,
        },
      })
      toast.success('Rating submitted! Held in pending state for Administrative review & verification call.')
      onRated()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/95 text-card-foreground shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto card-3d border-top-complaints">
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <div className="flex items-center gap-2 font-bold text-base">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              Rate Technician: {report.assignedTo ?? 'Technician'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Your review boosts the worker&apos;s recommendations. Please provide genuine details.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 py-2 text-xs">
          {/* Policy Consent Screen */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2 text-sky-900 dark:text-sky-300">
            <p className="font-bold flex items-center gap-1.5 text-xs">
              <ShieldAlert className="h-4 w-4 text-sky-600" />
              Phone Privacy &amp; Verification Policy
            </p>
            <p className="text-[11px] leading-relaxed opacity-90">
              To prevent false or exaggerated reviews and protect technician livelihoods, your phone number is used strictly for an automated in-app administrative verification call. Unverified or false ratings are rejected with account warnings.
            </p>
            <label className="flex items-start gap-2 pt-1 cursor-pointer font-semibold text-xs text-foreground">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>I agree to the phone verification policy and confirm this review is accurate.</span>
            </label>
          </div>

          {/* User Phone */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Contact Phone Number * (for Verification Call)</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765-43210"
              className="text-xs h-9 font-mono"
            />
          </div>

          {/* Overall Stars */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Overall Rating</Label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStars(s)}
                  className="p-1.5 star-rating-btn cursor-pointer"
                  aria-label={`${s} Stars`}
                >
                  <Star
                    className={cn(
                      'h-7 w-7 transition-all duration-200',
                      s <= stars
                        ? 'text-amber-500 fill-amber-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.55)] scale-105'
                        : 'text-muted-foreground/35 hover:text-amber-400'
                    )}
                  />
                </button>
              ))}
              <span className="font-extrabold ml-2 text-sm text-amber-600 dark:text-amber-400">{stars} / 5</span>
            </div>
          </div>

          {/* Breakdown selects */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Work Quality</Label>
              <Select value={String(quality)} onValueChange={(v) => setQuality(Number(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Punctuality</Label>
              <Select value={String(timeliness)} onValueChange={(v) => setTimeliness(Number(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Cleanliness</Label>
              <Select value={String(cleanliness)} onValueChange={(v) => setCleanliness(Number(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Detailed Feedback */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Review &amp; Feedback Details</Label>
            <Textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Describe how the work was carried out, timeliness, and behavior..."
              className="text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            size="sm"
            onClick={submitRating}
            disabled={submitting || !consent || !phone}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
          >
            {submitting ? 'Submitting…' : 'Submit Rating for Review'}
          </Button>
        </div>
      </div>
    </div>
  )
}
