'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { can } from '@/lib/permissions'
import type { MaintenanceReport, ReportStatus } from '@/lib/types'
import { ZONES } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { useOfflineSync } from '@/lib/offline-sync'
import { Pill, STATUS_STYLES, relTime, dateTimeStr } from '@/components/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fileToDataUrl, ReportDetail } from '@/components/maintenance-detail'
import { CameraCaptureModal } from '@/components/camera-capture-modal'
import {
  AirVent, Armchair, Camera, CheckCircle2, CircleDot, Cog, Droplets, HandCoins,
  SearchCheck, ShieldCheck, Wrench, X, Zap, UserCheck, PhoneCall, Sparkles, Upload
} from 'lucide-react'

export const FIELD_TECHNICIANS: Record<string, { name: string; title: string; phone: string; rating: string }[]> = {
  ELECTRICAL: [
    { name: 'Meera Krishnan', title: 'Lead Certified Electrician', phone: '+91 98765-43210', rating: '4.9 ★' },
    { name: 'Raman Patel', title: 'High Voltage & Wiring Tech', phone: '+91 98765-43211', rating: '4.8 ★' },
  ],
  PLUMBING: [
    { name: 'Suresh Kumar', title: 'Master Plumber & Sanitization', phone: '+91 98765-43212', rating: '4.9 ★' },
    { name: 'Dinesh Yadav', title: 'Pipes, Valves & Drainage', phone: '+91 98765-43213', rating: '4.7 ★' },
  ],
  HVAC: [
    { name: 'Amit Verma', title: 'HVAC & Central AC Specialist', phone: '+91 98765-43214', rating: '4.9 ★' },
    { name: 'Rajesh Shinde', title: 'Duct & Ventilation Operator', phone: '+91 98765-43215', rating: '4.8 ★' },
  ],
  STRUCTURAL: [
    { name: 'Ramesh Sharma', title: 'Masonry & Civil Engineering', phone: '+91 98765-43216', rating: '4.8 ★' },
    { name: 'Anil Bind', title: 'Structural Repairs Specialist', phone: '+91 98765-43217', rating: '4.7 ★' },
  ],
  FURNITURE: [
    { name: 'Kishan Mistri', title: 'Senior Woodwork & Carpenter', phone: '+91 98765-43218', rating: '4.8 ★' },
    { name: 'Mohan Lal', title: 'Fixtures & Furniture Repair', phone: '+91 98765-43219', rating: '4.7 ★' },
  ],
  EQUIPMENT: [
    { name: 'Sunita Rao', title: 'IT Hardware & Lab Instruments', phone: '+91 98765-43220', rating: '4.9 ★' },
    { name: 'Vikas Gupta', title: 'Electronics & Audio-Visual', phone: '+91 98765-43221', rating: '4.8 ★' },
  ],
  SAFETY: [
    { name: 'Vikram Singh', title: 'Campus Fire & Safety Inspector', phone: '+91 98765-43222', rating: '5.0 ★' },
  ],
}

const CATEGORIES = [
  { id: 'ELECTRICAL', labelEn: 'Electrical', labelHi: 'विद्युत', icon: <Zap className="h-4 w-4" /> },
  { id: 'PLUMBING', labelEn: 'Plumbing', labelHi: 'प्लंबिंग', icon: <Droplets className="h-4 w-4" /> },
  { id: 'HVAC', labelEn: 'HVAC / AC', labelHi: 'एसी / वेंटिलेशन', icon: <AirVent className="h-4 w-4" /> },
  { id: 'STRUCTURAL', labelEn: 'Structural', labelHi: 'भवन संरचना', icon: <Armchair className="h-4 w-4" /> },
  { id: 'FURNITURE', labelEn: 'Furniture', labelHi: 'फर्नीचर', icon: <Armchair className="h-4 w-4" /> },
  { id: 'EQUIPMENT', labelEn: 'Equipment', labelHi: 'उपकरण व आईटी', icon: <Cog className="h-4 w-4" /> },
  { id: 'SAFETY', labelEn: 'Safety / Fire', labelHi: 'अग्निशमन व सुरक्षा', icon: <ShieldCheck className="h-4 w-4" /> },
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
  const { lang, t } = useI18n()

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All priorities</SelectItem>
              {PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label} priority</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {user && !can.viewAllReports(user.role) ? 'Showing your reports' : `${reports.length} reports tracked`}
          </p>
        </div>

        {/* Complaint Register Modal */}
        <ReportDialog onDone={() => queryClient.invalidateQueries({ queryKey: ['maintenance'] })} />
      </div>

      {/* 3-Step Verification Pipeline */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground shadow-sm">
        <span className="font-bold text-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          {lang === 'hi' ? '3-चरणीय सत्यापन प्रक्रिया:' : '3-Step Verification Process:'}
        </span>
        <span><b>1.</b> {lang === 'hi' ? 'शिकायत व तकनीशियन चयन' : 'Report & Field Technician Selection'}</span>
        <span><b>2.</b> {lang === 'hi' ? 'मरम्मत उपरांत कैमरा फोटो व AI जांच' : 'Camera Photo & AI Tamper Check'}</span>
        <span><b>3.</b> {lang === 'hi' ? 'उपयोगकर्ता पुष्टि व अंतिम सत्यापन' : 'User Confirmation & Final Resolution'}</span>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = filtered.filter((r) => col.ids.includes(r.status))
          return (
            <div key={col.label} className="rounded-2xl border bg-card/60 p-3.5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <CircleDot className={cn('h-3.5 w-3.5', col.accent)} />
                  {col.label}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {items.length}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
                {items.length === 0 && (
                  <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                    {col.empty}
                  </p>
                )}

                {items.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setDetailId(r.id)}
                    className="cursor-pointer rounded-xl border bg-background/90 p-3.5 hover:border-emerald-500/50 transition-all shadow-sm space-y-2 hover:shadow-md cyber-card"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {r.code}
                      </span>
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold border', PRIORITY_CLS[r.priority])}>
                        {r.priority}
                      </span>
                    </div>

                    <p className="text-xs font-bold leading-snug line-clamp-2">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{r.zone} {r.location ? `· ${r.location}` : ''}</p>

                    {/* Assigned Technician Tag */}
                    {r.assignedTo && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <UserCheck className="h-3 w-3" />
                        <span>Tech: {r.assignedTo}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                      <span>{r.reportedBy}</span>
                      <span>{relTime(r.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {detail && (
        <ReportDetail
          report={detail}
          onClose={() => setDetailId(null)}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ['maintenance'] })}
        />
      )}
    </div>
  )
}

function ReportDialog({ onDone }: { onDone: () => void }) {
  const { lang, t } = useI18n()
  const { isOnline, addOfflineReport } = useOfflineSync()

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [form, setForm] = useState({
    category: 'ELECTRICAL',
    title: '',
    description: '',
    zone: 'Academic Block A',
    location: '',
    priority: 'MEDIUM',
    assignedTo: '',
  })
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoNote, setPhotoNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const activeTechs = FIELD_TECHNICIANS[form.category] ?? []

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const url = await fileToDataUrl(f)
      setPhoto(url)
      setPhotoNote('File Attached (Manual Upload)')
    } catch {
      toast.error('Could not read image — please try another file')
    }
  }

  const submit = async () => {
    setSaving(true)
    const payload = { ...form, photoData: photo }

    // If offline, save locally
    if (!isOnline) {
      addOfflineReport(payload)
      toast.info('Saved in Offline Queue! Will auto-sync when online.', { duration: 5000 })
      setOpen(false)
      setSaving(false)
      onDone()
      return
    }

    try {
      await api('/api/maintenance', { method: 'POST', json: payload })
      toast.success(lang === 'hi' ? 'शिकायत सफलतापूर्वक दर्ज की गई!' : 'Fault reported successfully!')
      setForm({ category: 'ELECTRICAL', title: '', description: '', zone: 'Academic Block A', location: '', priority: 'MEDIUM', assignedTo: '' })
      setPhoto(null)
      setPhotoNote(null)
      setOpen(false)
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md">
            <Wrench className="h-3.5 w-3.5 mr-1.5" /> {t('maint.report_fault')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-emerald-500" />
              {t('maint.report_fault')}
            </DialogTitle>
            <DialogDescription>
              {lang === 'hi'
                ? 'शिकायत दर्ज करें, कार्यक्षेत्र अनुसार तकनीशियन चुनें और कैमरे से सीधा फोटो खींचकर AI सत्यापन प्राप्त करें।'
                : 'Report broken equipment, select a specialized field technician, and take a direct photo for AI verification.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t('maint.category')} *</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, category: c.id, assignedTo: '' })
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-medium transition-all',
                      form.category === c.id
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold shadow-sm'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {c.icon}
                    <span>{lang === 'hi' ? c.labelHi : c.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Field Technician Picker */}
            <div className="space-y-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <Label className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4" />
                {t('maint.tech_field')} ({form.category})
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {activeTechs.map((tech) => (
                  <button
                    key={tech.name}
                    type="button"
                    onClick={() => setForm({ ...form, assignedTo: tech.name })}
                    className={cn(
                      'p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col justify-between',
                      form.assignedTo === tech.name
                        ? 'border-emerald-600 bg-emerald-500/20 font-bold shadow-sm'
                        : 'border-border bg-card hover:border-emerald-500/40',
                    )}
                  >
                    <div>
                      <p className="font-bold flex items-center justify-between">
                        <span>{tech.name}</span>
                        <span className="text-[10px] text-amber-500 font-normal">{tech.rating}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">{tech.title}</p>
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-1 flex items-center gap-1">
                      <PhoneCall className="h-2.5 w-2.5" /> {tech.phone}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="r-title" className="text-xs font-semibold">{t('maint.what_broken')} *</Label>
              <Input
                id="r-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Broken water pipe / Sparks from distribution switch"
                className="text-xs h-10"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="r-desc" className="text-xs font-semibold">Detailed Description *</Label>
              <Textarea
                id="r-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Where is the issue, when did it start, severity…"
                className="text-xs"
              />
            </div>

            {/* Zone & Location */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Zone *</Label>
                <Select value={form.zone} onValueChange={(v) => setForm({ ...form, zone: v })}>
                  <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-loc" className="text-xs font-semibold">Exact Room / Spot</Label>
                <Input
                  id="r-loc"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Lab 204 / 2nd Floor Corridor"
                  className="text-xs h-10"
                />
              </div>
            </div>

            {/* Photo Capture & Verification */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Camera Photo Evidence &amp; AI Validation</Label>

              {photo ? (
                <div className="relative overflow-hidden rounded-xl border space-y-1 p-2 bg-muted/30">
                  <img src={photo} alt="Attached fault preview" className="max-h-40 w-full object-cover rounded-lg" />
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {photoNote || t('maint.photo_validation')}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-red-500 hover:text-red-700"
                      onClick={() => { setPhoto(null); setPhotoNote(null) }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCameraModalOpen(true)}
                    className="h-16 flex flex-col items-center justify-center gap-1 border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-bold text-emerald-700 dark:text-emerald-400"
                  >
                    <Camera className="h-5 w-5" />
                    <span>{t('maint.camera_capture')}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    className="h-16 flex flex-col items-center justify-center gap-1 border-dashed text-xs text-muted-foreground hover:bg-muted"
                  >
                    <Upload className="h-5 w-5" />
                    <span>Upload from Device</span>
                  </Button>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={saving || !form.title || !form.description || !form.zone}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {saving ? 'Submitting…' : t('maint.submit_report')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct Camera Capture Modal */}
      <CameraCaptureModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={(res) => {
          setPhoto(res.dataUrl)
          setPhotoNote(`${res.note} (${res.resolution})`)
        }}
        title="Direct Camera Verification Capture"
      />
    </>
  )
}
