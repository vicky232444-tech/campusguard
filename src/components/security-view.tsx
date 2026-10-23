'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { can } from '@/lib/permissions'
import type { SecurityEvent, VisitorLog } from '@/lib/types'
import { Pill, STATUS_STYLES, dateTimeStr, relTime, timeStr } from '@/components/shared'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DoorClosed, LogOut, ShieldAlert, ShieldCheck, UserPlus, Users, Sparkles, Check, FileCheck, Clock } from 'lucide-react'
import { ZONES } from '@/lib/types'

const VISITOR_TEMPLATES = [
  { label: 'Courier & Logistics Delivery', visitorName: 'BlueDart / Express Delivery', phone: '+91 98711-23450', purpose: 'Parcel Delivery to Reception / Dispatch', hostName: 'Facility Front Desk', zone: 'Block A (Residential / Inpatient)' },
  { label: 'Patient / Resident Family Visit', visitorName: 'Sunita Sharma (Visitor)', phone: '+91 98102-54321', purpose: 'Resident Visit / Inpatient Meeting', hostName: 'Aarav Sharma (Resident)', zone: 'Block A (Residential / Inpatient)' },
  { label: 'Technical Maintenance Contractor', visitorName: 'Rajesh Shinde (HVAC Tech)', phone: '+91 99201-87654', purpose: 'Central Chiller & Utility Inspection', hostName: 'Facilities Maintenance Desk', zone: 'Central Chiller & Utility Plant' },
  { label: 'Official Auditor / Business Guest', visitorName: 'Dr. K. N. Iyer (Auditor)', phone: '+91 94320-11223', purpose: 'Building Safety & Compliance Audit', hostName: 'Building Management Office', zone: 'Block B (Commercial / Diagnostic)' },
]

function SecurityStats({ events, visitors }: { events: SecurityEvent[]; visitors: VisitorLog[] }) {
  const dayAgo = Date.now() - 24 * 3600 * 1000
  const today = events.filter((e) => new Date(e.createdAt).getTime() >= dayAgo)
  const denied = today.filter((e) => e.eventType === 'ACCESS_DENIED').length
  const suspicious = today.filter((e) => e.isSuspicious).length
  const inside = visitors.filter((v) => v.status === 'INSIDE').length

  const cards = [
    { label: 'Access events (24h)', value: today.length, icon: <DoorClosed className="h-4 w-4" />, tone: 'text-foreground' },
    { label: 'Denied entries (24h)', value: denied, icon: <LogOut className="h-4 w-4" />, tone: denied > 0 ? 'text-red-500' : 'text-emerald-500' },
    { label: 'Suspicious (24h)', value: suspicious, icon: <ShieldAlert className="h-4 w-4" />, tone: suspicious > 0 ? 'text-amber-500' : 'text-emerald-500' },
    { label: 'Visitors inside', value: inside, icon: <Users className="h-4 w-4" />, tone: 'text-teal-500' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border bg-card p-3.5 shadow-sm cyber-card">
          <div className="flex items-center gap-2 text-muted-foreground">{c.icon}<p className="text-xs">{c.label}</p></div>
          <p className={cn('text-2xl font-bold mt-1', c.tone)}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}

export function SecurityView() {
  const user = useUserStore((s) => s.user)
  const queryClient = useQueryClient()
  const { lang, t } = useI18n()

  const [tab, setTab] = useState<'logs' | 'visitors'>('visitors')
  const [suspiciousOnly, setSuspiciousOnly] = useState(false)
  const manage = !!user && can.manageSecurity(user.role)

  const { data: eventsData } = useQuery({
    queryKey: ['security-events'],
    queryFn: () => api<{ events: SecurityEvent[] }>('/api/security/events?limit=120'),
    refetchInterval: 12000,
  })
  const { data: visitorsData } = useQuery({
    queryKey: ['visitors'],
    queryFn: () => api<{ visitors: VisitorLog[] }>('/api/security/visitors'),
    refetchInterval: 12000,
  })

  const events = (eventsData?.events ?? []).filter((e) => !suspiciousOnly || e.isSuspicious)
  const visitors = visitorsData?.visitors ?? []

  const checkout = async (id: string) => {
    try {
      await api(`/api/security/visitors/${id}/checkout`, { method: 'POST' })
      toast.success(lang === 'hi' ? 'आगंतुक चेक-आउट दर्ज किया गया' : 'Visitor checked out successfully')
      queryClient.invalidateQueries({ queryKey: ['visitors'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <SecurityStats events={eventsData?.events ?? []} visitors={visitors} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'logs' | 'visitors')}>
          <TabsList>
            <TabsTrigger value="visitors"><Users className="h-3.5 w-3.5 mr-1" /> {lang === 'hi' ? 'आगंतुक रजिस्टर' : 'Visitor Register'}</TabsTrigger>
            <TabsTrigger value="logs"><DoorClosed className="h-3.5 w-3.5 mr-1" /> {lang === 'hi' ? 'प्रवेश लॉग्स' : 'Access Logs'}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {tab === 'logs' && (
            <Button
              variant={suspiciousOnly ? 'default' : 'outline'}
              size="sm"
              className={suspiciousOnly ? 'bg-amber-600 hover:bg-amber-700 text-white font-bold' : ''}
              onClick={() => setSuspiciousOnly((v) => !v)}
            >
              <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Suspicious Only
            </Button>
          )}

          {/* Visitor Quick Check-In with Automatic Entry Filling */}
          {tab === 'visitors' && (
            <CheckInDialog onDone={() => queryClient.invalidateQueries({ queryKey: ['visitors'] })} />
          )}
        </div>
      </div>

      {tab === 'visitors' && (
        <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">
              {lang === 'hi' ? 'सक्रिय आगंतुक पास व इतिहास' : 'Active Visitor Passes & Records'}
            </span>
            <span className="text-xs text-muted-foreground">{visitors.length} total entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-2.5 text-left">Pass ID</th>
                  <th className="px-4 py-2.5 text-left">Visitor Name</th>
                  <th className="px-4 py-2.5 text-left">Phone</th>
                  <th className="px-4 py-2.5 text-left">Purpose</th>
                  <th className="px-4 py-2.5 text-left">Host &amp; Zone</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visitors.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {v.passNo}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{v.visitorName}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">{v.phone || '—'}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{v.purpose}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{v.hostName}</span>
                      <span className="block text-[11px] text-muted-foreground">{v.zone || 'Campus'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Pill label={v.status} className={STATUS_STYLES[v.status]} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {v.status === 'INSIDE' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => checkout(v.id)}
                          className="h-7 text-xs border-amber-500/40 text-amber-600 hover:bg-amber-500/10 font-bold"
                        >
                          <LogOut className="h-3 w-3 mr-1" /> Check Out
                        </Button>
                      )}
                      {v.status === 'CHECKED_OUT' && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Out at {timeStr(v.checkOutAt || v.checkInAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {visitors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No visitors recorded yet. Use Check in Visitor above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Restricted-Area Access Logstream</span>
            <span className="text-xs text-muted-foreground">{events.length} events logged</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-2.5 text-left">Time</th>
                  <th className="px-4 py-2.5 text-left">Person &amp; Credential</th>
                  <th className="px-4 py-2.5 text-left">Location</th>
                  <th className="px-4 py-2.5 text-left">Event Type</th>
                  <th className="px-4 py-2.5 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.map((e) => (
                  <tr key={e.id} className={cn('hover:bg-muted/30 transition-colors', e.isSuspicious && 'bg-amber-500/5')}>
                    <td className="px-4 py-3 text-muted-foreground font-mono">{timeStr(e.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">{e.personName}</span>
                      <span className="block text-[10px] text-muted-foreground font-mono">{e.credential}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{e.zone}</span>
                      <span className="block text-[10px] text-muted-foreground">{e.area}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold border',
                        e.eventType === 'ACCESS_GRANTED'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : 'bg-red-500/10 text-red-600 border-red-500/30'
                      )}>
                        {e.eventType.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.detail || 'Standard Badge Access'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function CheckInDialog({ onDone }: { onDone: () => void }) {
  const { lang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    visitorName: '',
    phone: '',
    purpose: '',
    hostName: '',
    zone: 'Block A (Residential / Inpatient)',
  })

  // Automatic entry autofill helper
  const applyTemplate = (t: typeof VISITOR_TEMPLATES[0]) => {
    setForm({
      visitorName: t.visitorName,
      phone: t.phone,
      purpose: t.purpose,
      hostName: t.hostName,
      zone: t.zone,
    })
    toast.info(`Autofilled template: "${t.label}"`)
  }

  // 1-Click Smart Auto-Fill
  const smartAutoFill = () => {
    const randomTemplate = VISITOR_TEMPLATES[Math.floor(Math.random() * VISITOR_TEMPLATES.length)]
    const randomDigits = Math.floor(1000 + Math.random() * 9000)
    setForm({
      ...randomTemplate,
      phone: `+91 98${randomDigits}-54321`,
    })
    toast.success('Instant Smart Autofill applied!')
  }

  const submit = async () => {
    setSaving(true)
    try {
      await api('/api/security/visitors', { method: 'POST', json: form })
      toast.success(lang === 'hi' ? 'आगंतुक पास जारी कर दिया गया!' : 'Visitor checked in — Pass generated!')
      setForm({ visitorName: '', phone: '', purpose: '', hostName: '', zone: 'Block A (Residential / Inpatient)' })
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
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md">
          <UserPlus className="h-3.5 w-3.5 mr-1.5" /> {t('sec.visitor_checkin')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-500" />
            {t('sec.visitor_checkin')}
          </DialogTitle>
          <DialogDescription>
            {lang === 'hi'
              ? 'आगंतुक पास तुरंत जारी करें। मैन्युअल टाइपिंग से बचने के लिए नीचे दिए गए स्वचालित प्री-फिल का उपयोग करें।'
              : 'Issue verified visitor pass. Use 1-click automatic entry filling to save time.'}
          </DialogDescription>
        </DialogHeader>

        {/* Automatic Entry Filling Quick Bar */}
        <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              {t('sec.auto_fill')}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={smartAutoFill}
              className="h-6 text-[11px] font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
            >
              <Sparkles className="h-3 w-3 mr-1" /> Quick Auto-Fill
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {VISITOR_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.label}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className="text-left p-1.5 rounded-lg border bg-card hover:bg-emerald-500/10 hover:border-emerald-500/40 text-[11px] transition-colors"
              >
                <span className="font-semibold block truncate">{tmpl.label}</span>
                <span className="text-[10px] text-muted-foreground block truncate">{tmpl.purpose}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="v-name" className="text-xs font-semibold">Visitor Full Name *</Label>
            <Input
              id="v-name"
              value={form.visitorName}
              onChange={(e) => setForm({ ...form, visitorName: e.target.value })}
              placeholder="e.g. Ramesh Gupta"
              className="text-xs h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-phone" className="text-xs font-semibold">Mobile Phone *</Label>
              <Input
                id="v-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98..."
                className="text-xs h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Zone *</Label>
              <Select value={form.zone} onValueChange={(v) => setForm({ ...form, zone: v })}>
                <SelectTrigger className="text-xs h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-purpose" className="text-xs font-semibold">Purpose of Visit *</Label>
            <Input
              id="v-purpose"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="e.g. Equipment inspection / Meeting"
              className="text-xs h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-host" className="text-xs font-semibold">Host / Officer to Meet *</Label>
            <Input
              id="v-host"
              value={form.hostName}
              onChange={(e) => setForm({ ...form, hostName: e.target.value })}
              placeholder="e.g. Dr. Anil Rao (Admin)"
              className="text-xs h-10"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving || !form.visitorName || !form.purpose || !form.hostName}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {saving ? 'Issuing Pass…' : t('sec.issue_pass')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
