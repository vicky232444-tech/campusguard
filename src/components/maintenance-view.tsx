'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { can } from '@/lib/permissions'
import type { MaintenanceReport, ReportStatus } from '@/lib/types'
import { ZONES } from '@/lib/types'
import { Pill, STATUS_STYLES, relTime, dateTimeStr } from '@/components/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fileToDataUrl, ReportDetail } from '@/components/maintenance-detail'
import {
  AirVent, Armchair, Camera, CheckCircle2, CircleDot, Cog, Droplets, HandCoins,
  SearchCheck, ShieldCheck, Wrench, X, Zap,
} from 'lucide-react'

const CATEGORIES = [
  { id: 'ELECTRICAL', label: 'Electrical', icon: <Zap className="h-4 w-4" /> },
  { id: 'PLUMBING', label: 'Plumbing', icon: <Droplets className="h-4 w-4" /> },
  { id: 'HVAC', label: 'HVAC', icon: <AirVent className="h-4 w-4" /> },
  { id: 'STRUCTURAL', label: 'Structural', icon: <Armchair className="h-4 w-4" /> },
  { id: 'FURNITURE', label: 'Furniture', icon: <Armchair className="h-4 w-4" /> },
  { id: 'EQUIPMENT', label: 'Equipment', icon: <Cog className="h-4 w-4" /> },
  { id: 'SAFETY', label: 'Safety / Fire', icon: <ShieldCheck className="h-4 w-4" /> },
]

const PRIORITIES = [
  { id: 'LOW', label: 'Low', cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30' },
  { id: 'MEDIUM', label: 'Medium', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  { id: 'HIGH', label: 'High', cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  { id: 'URGENT', label: 'Urgent', cls: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30' },
]

const PRIORITY_CLS = Object.fromEntries(PRIORITIES.map((p) => [p.id, p.cls]))

const COLUMNS: { ids: ReportStatus[]; label: string; accent: string; empty: string }[] = [
  { ids: ['PENDING'], label: 'Pending admin check', accent: 'text-amber-500', empty: 'No pending requests' },
  { ids: ['APPROVED', 'IN_PROGRESS'], label: 'Approved / in progress', accent: 'text-sky-500', empty: 'Nothing being repaired right now' },
  { ids: ['PROOF_SUBMITTED', 'AWAITING_ADMIN'], label: 'AI verification', accent: 'text-purple-500', empty: 'No repairs in verification' },
  { ids: ['RESOLVED'], label: 'Resolved', accent: 'text-emerald-500', empty: 'No resolved requests yet' },
]

export function MaintenanceView() {
  const user = useUserStore((s) => s.user)
  const queryClient = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [filterPriority, setFilterPriority] = useState<string>('ALL')

  const { data: reportsData } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => api<{ reports: MaintenanceReport[] }>('/api/maintenance'),
    refetchInterval: 10000,
  })
  const reports = reportsData?.reports ?? []
  const filtered = reports.filter((r) => filterPriority === 'ALL' || r.priority === filterPriority)

  const detail = filtered.find((r) => r.id === detailId) ?? null
  const rejected = filtered.filter((r) => r.status === 'REJECTED')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All priorities</SelectItem>
              {PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label} priority</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {user && !can.viewAllReports(user.role) ? 'Showing your reports' : `${reports.length} reports tracked`}
          </p>
        </div>
        <ReportDialog onDone={() => queryClient.invalidateQueries({ queryKey: ['maintenance'] })} />
      </div>

      {/* Workflow channel explainer */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">3-step verification channel:</span>
        <span><b className="text-foreground">1.</b> User reports → Admin verifies &amp; forwards</span>
        <span><b className="text-foreground">2.</b> Maintenance uploads proof → AI detects morphing (fine if tampered)</span>
        <span><b className="text-foreground">3.</b> Reporter uploads confirmation → AI matches both → Admin final verdict</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = filtered.filter((r) => col.ids.includes(r.status))
          return (
            <div key={col.label} className="rounded-xl border bg-muted/30 p-3">
              <div className="mb-2.5 flex items-center gap-2 px-1">
                {col.label === 'Resolved' ? <CheckCircle2 className={cn('h-4 w-4', col.accent)} /> : <CircleDot className={cn('h-4 w-4', col.accent)} />}
                <p className="text-sm font-semibold">{col.label}</p>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-0.5 [scrollbar-width:thin]">
                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{col.empty}</p>
                )}
                {items.map((r) => (
                  <ReportCard key={r.id} report={r} onOpen={() => setDetailId(r.id)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Rejected by AI strip */}
      {rejected.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <p className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-red-600 dark:text-red-400">
            <SearchCheck className="h-4 w-4" /> Rejected by AI — morphed proof uploads
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {rejected.map((r) => (
              <ReportCard key={r.id} report={r} onOpen={() => setDetailId(r.id)} />
            ))}
          </div>
        </div>
      )}

      <FinesPanel />

      <ReportDetail
        report={detail}
        onClose={() => setDetailId(null)}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ['maintenance'] })
          queryClient.invalidateQueries({ queryKey: ['fines'] })
          queryClient.invalidateQueries({ queryKey: ['alerts'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        }}
      />
    </div>
  )
}

function ReportCard({ report, onOpen }: { report: MaintenanceReport; onOpen: () => void }) {
  const cat = CATEGORIES.find((c) => c.id === report.category)
  return (
    <button
      onClick={onOpen}
      className="w-full rounded-lg border bg-card p-3 text-left transition-all hover:border-emerald-500/40 hover:shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-semibold text-muted-foreground">{report.code}</span>
        <Pill label={report.priority} className={cn('text-[10px]', PRIORITY_CLS[report.priority])} />
        {report.photoData && <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"><Camera className="h-3 w-3" /> photo</span>}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{report.title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">{cat?.icon}{cat?.label ?? report.category}</span>
        <span>· {report.zone}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>by {report.reportedBy}</span>
        <span>· {relTime(report.createdAt)}</span>
        {report.status === 'AWAITING_ADMIN' && (
          <Pill label="final verdict due" className="text-[9px] bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" />
        )}
        {report.status === 'PROOF_SUBMITTED' && (
          <Pill label="awaiting confirmation" className="text-[9px] bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" />
        )}
      </div>
      {report.assignedTo && (
        <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">→ {report.assignedTo}{report.reworkCount > 0 ? ` · rework ×${report.reworkCount}` : ''}</p>
      )}
    </button>
  )
}

function FinesPanel() {
  const user = useUserStore((s) => s.user)
  const queryClient = useQueryClient()
  const [waiving, setWaiving] = useState<string | null>(null)

  const { data: finesData } = useQuery({
    queryKey: ['fines'],
    queryFn: () => api<{ fines: { id: string; reportCode: string; finedTo: string; amount: number; reason: string; status: 'ISSUED' | 'WAIVED'; issuedBy: string; createdAt: string }[] }>('/api/fines'),
    enabled: !!user && can.viewFines(user.role),
    refetchInterval: 15000,
  })

  if (!user || !can.viewFines(user.role) || !finesData?.fines.length) return null
  const fines = finesData.fines
  const totalOutstanding = fines.filter((f) => f.status === 'ISSUED').reduce((s, f) => s + f.amount, 0)

  const waive = async (id: string) => {
    setWaiving(id)
    try {
      await api(`/api/fines/${id}`, { method: 'POST', json: { status: 'WAIVED' } })
      toast.success('Fine waived')
      queryClient.invalidateQueries({ queryKey: ['fines'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setWaiving(null)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <HandCoins className="h-4 w-4 text-red-500" />
        <p className="text-sm font-semibold">Fines for wrong (morphed) proof uploads</p>
        <span className="ml-auto text-xs text-muted-foreground">
          Outstanding: <b className="text-red-600 dark:text-red-400">₹{totalOutstanding.toLocaleString('en-IN')}</b>
        </span>
      </div>
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {fines.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-2.5 text-xs">
            <span className="font-mono text-[10px] font-semibold text-muted-foreground">{f.reportCode}</span>
            <span className="font-medium">{f.finedTo}</span>
            <span className={cn('font-semibold', f.status === 'ISSUED' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
              ₹{f.amount.toLocaleString('en-IN')}
            </span>
            <Pill label={f.status} className={STATUS_STYLES[f.status]} />
            <span className="text-[10px] text-muted-foreground w-full sm:w-auto sm:ml-auto">{dateTimeStr(f.createdAt)}</span>
            {user.role === 'ADMIN' && f.status === 'ISSUED' && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" disabled={waiving === f.id} onClick={() => waive(f.id)}>
                Waive
              </Button>
            )}
            <p className="w-full text-[10px] leading-snug text-muted-foreground">{f.reason}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ category: 'ELECTRICAL', title: '', description: '', zone: '', location: '', priority: 'MEDIUM' })
  const [photo, setPhoto] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      setPhoto(await fileToDataUrl(f))
    } catch {
      toast.error('Could not read that image — try another file')
    }
  }

  const submit = async () => {
    setSaving(true)
    try {
      await api('/api/maintenance', { method: 'POST', json: { ...form, photoData: photo } })
      toast.success('Fault reported — the administrator will verify & forward it')
      setForm({ category: 'ELECTRICAL', title: '', description: '', zone: '', location: '', priority: 'MEDIUM' })
      setPhoto(null)
      setOpen(false)
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Wrench className="h-3.5 w-3.5" /> Report a fault
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report broken equipment / fault</DialogTitle>
          <DialogDescription>
            Your report goes to the administrator for verification, then to the maintenance team. Photo evidence helps the AI verify the repair later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setForm({ ...form, category: c.id })}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition-colors',
                    form.category === c.id ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {c.icon}{c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-title">What is broken? *</Label>
            <Input id="r-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Sparks from distribution board near lab entrance" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-desc">Describe the problem *</Label>
            <Textarea id="r-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Include what happened, when you noticed it, and anything staff should watch out for…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Building / zone *</Label>
              <Select value={form.zone} onValueChange={(v) => setForm({ ...form, zone: v })}>
                <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-loc">Exact location</Label>
              <Input id="r-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Room 105 / corridor C" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setForm({ ...form, priority: p.id })}
                  className={cn(
                    'rounded-lg border p-2 text-xs transition-colors',
                    form.priority === p.id ? 'border-foreground/40 bg-muted font-semibold' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Photo evidence (optional)</Label>
            {photo ? (
              <div className="relative overflow-hidden rounded-lg border">
                <img src={photo} alt="Attached fault photo preview" className="max-h-44 w-full object-cover" />
                <Button size="icon" variant="secondary" className="absolute right-2 top-2 h-7 w-7" onClick={() => setPhoto(null)} aria-label="Remove photo">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed p-5 text-xs text-muted-foreground transition-colors hover:border-emerald-500/40 hover:bg-muted/50"
              >
                <Camera className="h-5 w-5" />
                Attach a photograph of the damage
                <span className="text-[10px]">auto-compressed on device · JPG/PNG</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Choose photo" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.title || !form.description || !form.zone} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? 'Submitting…' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
