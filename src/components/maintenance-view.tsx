'use client'

import { useRef, useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { can } from '@/lib/permissions'
import type { MaintenanceReport, ReportStatus, StudentVerification, WorkerRating, SuspensionAppeal } from '@/lib/types'
import { ZONES, BUILDING_ZONES_CONFIG } from '@/lib/types'
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
  SearchCheck, ShieldCheck, Wrench, X, Zap, UserCheck, PhoneCall, Sparkles, Upload,
  Clock, Search, UserPlus, ShieldAlert, Check, AlertCircle, FileText, Star, PhoneIncoming,
  RotateCcw, CheckCircle, Ban, AlertOctagon
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

  const [activeTab, setActiveTab] = useState<'repairs' | 'students' | 'ratings' | 'appeals'>('repairs')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [filterPriority, setFilterPriority] = useState<string>('ALL')

  const isAdmin = user?.role === 'ADMIN'

  const { data: verifData } = useQuery({
    queryKey: ['student-verifications'],
    queryFn: () => api<{ records: StudentVerification[] }>('/api/students/verification'),
    refetchInterval: 12000,
  })
  const studentRecords = verifData?.records ?? []

  const { data: ratingsData } = useQuery({
    queryKey: ['worker-ratings'],
    queryFn: () => api<{ ratings: WorkerRating[] }>('/api/ratings'),
    enabled: isAdmin,
    refetchInterval: 10000,
  })
  const ratings = ratingsData?.ratings ?? []
  const pendingRatingsCount = ratings.filter((r) => r.status === 'PENDING_ADMIN_REVIEW' || r.status === 'CALL_VERIFIED').length

  const { data: appealsData } = useQuery({
    queryKey: ['suspension-appeals'],
    queryFn: () => api<{ appeals: SuspensionAppeal[] }>('/api/users/appeals'),
    enabled: isAdmin,
    refetchInterval: 10000,
  })
  const appeals = appealsData?.appeals ?? []
  const pendingAppealsCount = appeals.filter((a) => a.status === 'PENDING').length

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
      {/* Top Tab Switcher: Repairs vs Student Records vs Ratings vs Appeals */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab('repairs')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all',
            activeTab === 'repairs'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Wrench className="h-4 w-4" />
          {lang === 'hi' ? 'शिकायतें व मरम्मत कार्य' : 'Building Repairs & Complaints'}
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('students')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all',
                activeTab === 'students'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <UserCheck className="h-4 w-4" />
              {lang === 'hi' ? 'पहचान / छात्र सत्यापन (एडमिन)' : 'Identity & Student Verification (Admin)'}
              {studentRecords.length > 0 && (
                <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-mono">
                  {studentRecords.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('ratings')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all',
                activeTab === 'ratings'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Star className="h-4 w-4 text-amber-500" />
              <span>{lang === 'hi' ? 'तकनीशियन समीक्षा अनुमोदन' : 'Worker Ratings Review'}</span>
              {pendingRatingsCount > 0 && (
                <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.2 text-[10px] font-mono">
                  {pendingRatingsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('appeals')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all',
                activeTab === 'appeals'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <AlertOctagon className="h-4 w-4 text-red-500" />
              <span>{lang === 'hi' ? 'निलंबन अपील समीक्षा' : 'Suspension Appeals'}</span>
              {pendingAppealsCount > 0 && (
                <span className="rounded-full bg-red-500/20 text-red-700 dark:text-red-400 px-1.5 py-0.2 text-[10px] font-mono">
                  {pendingAppealsCount}
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {activeTab === 'students' && isAdmin ? (
        <StudentVerificationSection />
      ) : activeTab === 'ratings' && isAdmin ? (
        <AdminRatingsSection />
      ) : activeTab === 'appeals' && isAdmin ? (
        <AdminAppealsSection />
      ) : (
        <>
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

            {/* Complaint Register Modal - Available for Residents, Students & Admins (NOT Maintenance Team) */}
            {user?.role !== 'MAINTENANCE' && (
              <ReportDialog onDone={() => queryClient.invalidateQueries({ queryKey: ['maintenance'] })} />
            )}
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
        </>
      )}
    </div>
  )
}

function ReportDialog({ onDone }: { onDone: () => void }) {
  const { lang, t } = useI18n()
  const { isOnline, addOfflineReport } = useOfflineSync()

  const defaultZone = Object.keys(BUILDING_ZONES_CONFIG)[0] || 'Residential & Inpatient Block A'
  const defaultPlaces = BUILDING_ZONES_CONFIG[defaultZone]?.places || []

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [form, setForm] = useState({
    category: 'ELECTRICAL',
    title: '',
    description: '',
    zone: defaultZone,
    exactPlace: defaultPlaces[0] || '',
    location: defaultPlaces[0] || '',
    priority: 'MEDIUM',
    assignedTo: '',
  })
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoNote, setPhotoNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Rank technicians by rating score (highest-rated shown first in each department)
  const activeTechs = useMemo(() => {
    const list = [...(FIELD_TECHNICIANS[form.category] ?? [])]
    return list.sort((a, b) => {
      const scoreA = parseFloat(a.rating) || 0
      const scoreB = parseFloat(b.rating) || 0
      return scoreB - scoreA
    })
  }, [form.category])

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
      setForm({
        category: 'ELECTRICAL',
        title: '',
        description: '',
        zone: defaultZone,
        exactPlace: defaultPlaces[0] || '',
        location: defaultPlaces[0] || '',
        priority: 'MEDIUM',
        assignedTo: '',
      })
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onCloseAutoFocus={(e) => e.preventDefault()}>
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

            {/* Cascading Building / Zone & Exact Place Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Building / Zone *</Label>
                <Select
                  value={form.zone}
                  onValueChange={(v) => {
                    const places = BUILDING_ZONES_CONFIG[v]?.places || []
                    setForm({ ...form, zone: v, exactPlace: places[0] || '', location: places[0] || '' })
                  }}
                >
                  <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(BUILDING_ZONES_CONFIG).map((z) => (
                      <SelectItem key={z} value={z}>{z}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Exact Place within Building *</Label>
                <Select
                  value={form.exactPlace || (BUILDING_ZONES_CONFIG[form.zone]?.places?.[0] ?? '')}
                  onValueChange={(v) => setForm({ ...form, exactPlace: v, location: v })}
                >
                  <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Select exact area" /></SelectTrigger>
                  <SelectContent>
                    {(BUILDING_ZONES_CONFIG[form.zone]?.places || []).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

function StudentVerificationSection() {
  const user = useUserStore((s) => s.user)
  const queryClient = useQueryClient()
  const { lang } = useI18n()
  const isAdmin = user?.role === 'ADMIN'

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  const [newStudent, setNewStudent] = useState({
    studentName: '',
    rollNumber: '',
    department: 'Computer Science & Engineering',
    yearOfStudy: '1st Year',
    hostelRoom: '',
    contactPhone: '',
  })

  const { data: verifData } = useQuery({
    queryKey: ['student-verifications'],
    queryFn: () => api<{ records: StudentVerification[] }>('/api/students/verification'),
    refetchInterval: 10000,
  })
  const records = verifData?.records ?? []

  const filtered = records.filter((r) => {
    const matchesSearch = !search ||
      r.studentName.toLowerCase().includes(search.toLowerCase()) ||
      r.rollNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.department.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const verifiedCount = records.filter((r) => r.status === 'VERIFIED').length
  const pendingCount = records.filter((r) => r.status === 'PENDING').length

  const handleRunAiVerification = async (id: string) => {
    setVerifyingId(id)
    try {
      const res = await api<{ record: StudentVerification }>(`/api/students/verification/${id}/verify`, {
        method: 'POST',
        json: { action: 'APPROVE' },
      })
      toast.success(`AI Verification Complete: ${res.record.studentName} is Authenticated (${res.record.aiConfidenceScore}%)`)
      queryClient.invalidateQueries({ queryKey: ['student-verifications'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setVerifyingId(null)
    }
  }

  const handleRejectStudent = async (id: string) => {
    try {
      await api(`/api/students/verification/${id}/verify`, {
        method: 'POST',
        json: { action: 'REJECT', remarks: 'Verification declined by administrator.' },
      })
      toast.info('Student verification rejected.')
      queryClient.invalidateQueries({ queryKey: ['student-verifications'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleAddStudent = async () => {
    if (!newStudent.studentName || !newStudent.rollNumber) {
      toast.error('Student Name and Roll Number are required')
      return
    }
    try {
      await api('/api/students/verification', {
        method: 'POST',
        json: newStudent,
      })
      toast.success('Student record added and queued for verification')
      setAddModalOpen(false)
      setNewStudent({
        studentName: '',
        rollNumber: '',
        department: 'Computer Science & Engineering',
        yearOfStudy: '1st Year',
        hostelRoom: '',
        contactPhone: '',
      })
      queryClient.invalidateQueries({ queryKey: ['student-verifications'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-500" />
            {lang === 'hi' ? 'विद्यार्थी सत्यापन व रिकॉर्ड्स' : 'Student Records & AI Verification'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAdmin
              ? 'Administrator management portal for student identities, roll numbers and biometric AI tamper validation.'
              : 'View your student verification status and authentic biometric AI badge.'}
          </p>
        </div>

        {isAdmin && (
          <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-md">
                <UserPlus className="h-3.5 w-3.5" /> Add Student Record
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-emerald-500" /> Add New Student Record
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Create a new student record for biometric and ID verification.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 py-2 text-xs">
                <div className="space-y-1">
                  <Label>Full Student Name *</Label>
                  <Input
                    value={newStudent.studentName}
                    onChange={(e) => setNewStudent({ ...newStudent, studentName: e.target.value })}
                    placeholder="e.g. Aarav Sharma"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Roll Number / Student ID *</Label>
                  <Input
                    value={newStudent.rollNumber}
                    onChange={(e) => setNewStudent({ ...newStudent, rollNumber: e.target.value })}
                    placeholder="e.g. CS-2024-0419"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Department</Label>
                    <Input
                      value={newStudent.department}
                      onChange={(e) => setNewStudent({ ...newStudent, department: e.target.value })}
                      placeholder="e.g. Computer Science"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Year of Study</Label>
                    <Input
                      value={newStudent.yearOfStudy}
                      onChange={(e) => setNewStudent({ ...newStudent, yearOfStudy: e.target.value })}
                      placeholder="e.g. 1st Year"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Hostel Room</Label>
                    <Input
                      value={newStudent.hostelRoom}
                      onChange={(e) => setNewStudent({ ...newStudent, hostelRoom: e.target.value })}
                      placeholder="e.g. Block B - 204"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Contact Phone</Label>
                    <Input
                      value={newStudent.contactPhone}
                      onChange={(e) => setNewStudent({ ...newStudent, contactPhone: e.target.value })}
                      placeholder="+91 98765-..."
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>Cancel</Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={handleAddStudent}>
                  Save &amp; Queue Verification
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Students</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{records.length}</p>
          <p className="text-[10px] text-muted-foreground">Enrolled directory</p>
        </div>
        <div className="rounded-2xl border bg-card p-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">AI Verified</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{verifiedCount}</p>
          <p className="text-[10px] text-muted-foreground">Biometrics &amp; ID validated</p>
        </div>
        <div className="rounded-2xl border bg-card p-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Pending Review</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{pendingCount}</p>
          <p className="text-[10px] text-muted-foreground">Awaiting AI verification</p>
        </div>
        <div className="rounded-2xl border bg-card p-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">AI Confidence Avg</p>
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-0.5">97.8%</p>
          <p className="text-[10px] text-muted-foreground">High confidence threshold</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, roll number, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(['ALL', 'VERIFIED', 'PENDING', 'REJECTED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                filterStatus === status
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Students List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
            No student verification records found.
          </div>
        ) : (
          filtered.map((student) => (
            <div
              key={student.id}
              className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-all space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-base shadow-sm">
                    {student.studentName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-foreground">{student.studentName}</h3>
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        {student.rollNumber}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {student.department} · {student.yearOfStudy}
                      {student.hostelRoom ? ` · ${student.hostelRoom}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {student.status === 'VERIFIED' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-4 w-4" /> AI Verified
                    </span>
                  )}
                  {student.status === 'PENDING' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5 animate-spin" /> Pending AI Scan
                    </span>
                  )}
                  {student.status === 'REJECTED' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-600 dark:text-red-400">
                      <X className="h-3.5 w-3.5" /> Rejected
                    </span>
                  )}
                </div>
              </div>

              {/* AI Verification Breakdown Card */}
              <div className="rounded-xl border bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-muted-foreground">Confidence:</span>
                    <span className="font-bold text-foreground">
                      {student.aiConfidenceScore ? `${student.aiConfidenceScore}%` : 'Not run yet'}
                    </span>
                  </div>
                  <span className="text-muted-foreground">·</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Tamper Risk:</span>
                    <span className="font-bold text-emerald-600">
                      {student.aiConfidenceScore ? `${(100 - student.aiConfidenceScore).toFixed(1)}% (Minimal)` : '—'}
                    </span>
                  </div>
                  <span className="text-muted-foreground">·</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Biometrics:</span>
                    <span className="font-bold text-foreground">
                      {student.status === 'VERIFIED' ? 'Face & ID Card Matched' : 'Awaiting admin execution'}
                    </span>
                  </div>
                </div>

                {/* Admin Actions */}
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    {student.status !== 'VERIFIED' && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow"
                        onClick={() => handleRunAiVerification(student.id)}
                        disabled={verifyingId === student.id}
                      >
                        <Sparkles className="h-3 w-3" />
                        {verifyingId === student.id ? 'Analyzing…' : 'Run AI Verification'}
                      </Button>
                    )}
                    {student.status !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-red-500/30 text-red-600 hover:bg-red-500/10"
                        onClick={() => handleRejectStudent(student.id)}
                      >
                        Decline
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {student.remarks && (
                <p className="text-[11px] text-muted-foreground italic px-1">
                  Note: {student.remarks}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function AdminRatingsSection() {
  const queryClient = useQueryClient()
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectRatingId, setRejectRatingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)

  const { data } = useQuery({
    queryKey: ['worker-ratings'],
    queryFn: () => api<{ ratings: WorkerRating[] }>('/api/ratings'),
    refetchInterval: 8000,
  })
  const ratings = data?.ratings ?? []

  const filtered = ratings.filter((r) => filterStatus === 'ALL' || r.status === filterStatus)

  const handleSimulateCall = async (id: string) => {
    setActing(true)
    try {
      const res = await api<{ rating: WorkerRating; simulatedTranscript: string }>(`/api/ratings/${id}/verify-call`, {
        method: 'POST',
      })
      toast.success('Automated verification call placed to user!', {
        description: res.simulatedTranscript,
        duration: 8000,
      })
      queryClient.invalidateQueries({ queryKey: ['worker-ratings'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setActing(false)
    }
  }

  const handleApprove = async (id: string) => {
    setActing(true)
    try {
      await api(`/api/ratings/${id}/approve`, { method: 'POST', json: { adminNotes: 'Verified genuine by Admin' } })
      toast.success('Rating approved and passed to technician recommendation engine!')
      queryClient.invalidateQueries({ queryKey: ['worker-ratings'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setActing(false)
    }
  }

  const handleOpenReject = (id: string) => {
    setRejectRatingId(id)
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const submitReject = async () => {
    if (!rejectRatingId || !rejectReason.trim()) {
      toast.error('Rejection reason is required')
      return
    }
    setActing(true)
    try {
      const res = await api<{ rating: WorkerRating; warningCount: number; isSuspended: boolean }>(`/api/ratings/${rejectRatingId}/reject`, {
        method: 'POST',
        json: { rejectionReason: rejectReason.trim() },
      })
      if (res.isSuspended) {
        toast.error(`Rating rejected. User received 3rd warning and account was TEMPORARILY SUSPENDED.`, { duration: 8000 })
      } else {
        toast.warning(`Rating rejected as false. User received warning #${res.warningCount} of 3.`, { duration: 6000 })
      }
      setRejectModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['worker-ratings'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            Maintenance Worker Ratings &amp; Anti-Fraud Review
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Admin review flow: Verify submitted details for accuracy. Use automated verification call if in doubt. 3 false ratings within 6 months triggers temporary user suspension.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {(['ALL', 'PENDING_ADMIN_REVIEW', 'CALL_VERIFIED', 'APPROVED', 'REJECTED_FALSE'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                filterStatus === status
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {status.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
            No worker ratings matching filter.
          </div>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {r.reportCode}
                    </span>
                    <h3 className="text-sm font-bold">Worker: {r.workerName} ({r.workerCategory})</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Rated by <b>{r.userName}</b> · Phone: <span className="font-mono font-semibold">{r.userPhone}</span> {r.phoneConsentGiven && <span className="text-emerald-600 font-medium">(Consent on record)</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs font-bold">
                    <Star className="h-3.5 w-3.5 fill-amber-500" />
                    <span>{r.stars} / 5</span>
                  </div>
                  <Pill label={r.status} className={r.status === 'APPROVED' ? STATUS_STYLES.RESOLVED : r.status === 'REJECTED_FALSE' ? STATUS_STYLES.REJECTED : STATUS_STYLES.PENDING} />
                </div>
              </div>

              {/* Breakdown metrics */}
              <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-2.5 rounded-xl border">
                <div>
                  <span className="text-muted-foreground">Work Quality:</span> <b className="text-foreground">{r.workQualityScore}/5</b>
                </div>
                <div>
                  <span className="text-muted-foreground">Punctuality:</span> <b className="text-foreground">{r.timelinessScore}/5</b>
                </div>
                <div>
                  <span className="text-muted-foreground">Cleanliness:</span> <b className="text-foreground">{r.cleanlinessScore}/5</b>
                </div>
              </div>

              {r.feedback && (
                <p className="text-xs text-foreground bg-card p-2 rounded-lg border italic">
                  &ldquo;{r.feedback}&rdquo;
                </p>
              )}

              {/* Call Verification Log / Transcript */}
              {r.verificationCallNotes && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5 text-xs text-sky-800 dark:text-sky-300">
                  <p className="font-bold flex items-center gap-1.5">
                    <PhoneIncoming className="h-3.5 w-3.5" /> Automated Verification Call Transcript:
                  </p>
                  <p className="mt-1 text-[11px] font-mono whitespace-pre-wrap">{r.verificationCallNotes}</p>
                </div>
              )}

              {r.rejectionReason && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-700 dark:text-red-400">
                  <b>Rejection Reason (Warning Issued):</b> {r.rejectionReason}
                </div>
              )}

              {/* Admin Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
                <span className="text-muted-foreground text-[11px]">Submitted {relTime(r.createdAt)}</span>
                <div className="flex items-center gap-2">
                  {r.status !== 'APPROVED' && r.status !== 'REJECTED_FALSE' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 font-bold gap-1.5"
                        onClick={() => handleSimulateCall(r.id)}
                        disabled={acting}
                      >
                        <PhoneCall className="h-3.5 w-3.5" /> Automated Verification Call
                      </Button>

                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
                        onClick={() => handleApprove(r.id)}
                        disabled={acting}
                      >
                        <Check className="h-3.5 w-3.5" /> Approve Rating
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-red-500/40 text-red-600 hover:bg-red-500/10 font-bold gap-1.5"
                        onClick={() => handleOpenReject(r.id)}
                        disabled={acting}
                      >
                        <Ban className="h-3.5 w-3.5" /> Reject as False
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" /> Reject Rating as False / Exaggerated
            </DialogTitle>
            <DialogDescription className="text-xs">
              Every false rating issues a formal warning to the user. After 3 warnings in 6 months, the account is temporarily suspended.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rejection Reason *</Label>
              <Textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Details do not match the assigned work order or user denied rating on verification call..."
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectModalOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white font-bold" onClick={submitReject} disabled={acting}>
              {acting ? 'Processing…' : 'Confirm Rejection & Issue Warning'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdminAppealsSection() {
  const queryClient = useQueryClient()
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [acting, setActing] = useState(false)

  const { data } = useQuery({
    queryKey: ['suspension-appeals'],
    queryFn: () => api<{ appeals: SuspensionAppeal[] }>('/api/users/appeals'),
    refetchInterval: 8000,
  })
  const appeals = data?.appeals ?? []
  const filtered = appeals.filter((a) => filterStatus === 'ALL' || a.status === filterStatus)

  const handleReview = async (id: string, decision: 'APPROVE' | 'REJECT') => {
    setActing(true)
    try {
      await api(`/api/users/appeals/${id}/review`, {
        method: 'POST',
        json: {
          decision,
          adminNotes: decision === 'APPROVE' ? 'Account reinstated after evidence review.' : 'Appeal rejected due to lack of proof.',
        },
      })
      if (decision === 'APPROVE') {
        toast.success('Appeal approved! User account has been REINSTATED.')
      } else {
        toast.info('Appeal declined.')
      }
      queryClient.invalidateQueries({ queryKey: ['suspension-appeals'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-red-500" />
            User Suspension Appeals &amp; Account Reinstatement
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review written explanations and uploaded proof photos/videos from suspended users. Approving an appeal immediately lifts the suspension and clears the warning counter.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                filterStatus === status
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
            No suspension appeals found.
          </div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">{a.userName} ({a.userEmail})</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Phone: <span className="font-mono">{a.userPhone || '—'}</span> · Submitted {dateTimeStr(a.createdAt)}
                  </p>
                </div>
                <Pill label={a.status} className={a.status === 'APPROVED' ? STATUS_STYLES.RESOLVED : a.status === 'REJECTED' ? STATUS_STYLES.REJECTED : STATUS_STYLES.PENDING} />
              </div>

              <div className="space-y-1.5 bg-muted/30 p-3 rounded-xl border text-xs">
                <p className="font-bold text-foreground">User Explanation:</p>
                <p className="text-muted-foreground leading-relaxed">{a.explanation}</p>
              </div>

              {a.proofMedia && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-foreground">Attached Proof Media:</p>
                  {a.proofMedia.startsWith('data:image') || a.proofMedia.startsWith('http') ? (
                    <img src={a.proofMedia} alt="Appeal proof" className="max-h-48 rounded-lg border object-cover" />
                  ) : (
                    <p className="text-xs text-emerald-600 font-mono underline">{a.proofMedia}</p>
                  )}
                </div>
              )}

              {a.adminNotes && (
                <p className="text-xs text-muted-foreground italic">
                  Admin Verdict: {a.adminNotes} (by {a.reviewedBy || 'Admin'})
                </p>
              )}

              {a.status === 'PENDING' && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
                    onClick={() => handleReview(a.id, 'APPROVE')}
                    disabled={acting}
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Approve &amp; Reinstate Account
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-red-500/40 text-red-600 hover:bg-red-500/10 font-bold"
                    onClick={() => handleReview(a.id, 'REJECT')}
                    disabled={acting}
                  >
                    Decline Appeal
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
