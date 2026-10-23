'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { can } from '@/lib/permissions'
import type { SecurityEvent, VisitorLog } from '@/lib/types'
import { Pill, STATUS_STYLES, SimBadge, dateTimeStr, relTime, timeStr } from '@/components/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DoorClosed, LogOut, ShieldAlert, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { ZONES } from '@/lib/types'

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
        <div key={c.label} className="rounded-xl border bg-card p-3.5">
          <div className="flex items-center gap-2 text-muted-foreground">{c.icon}<p className="text-xs">{c.label}</p></div>
          <p className={cn('text-2xl font-semibold mt-1', c.tone)}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}

export function SecurityView() {
  const user = useUserStore((s) => s.user)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'logs' | 'visitors'>('logs')
  const [suspiciousOnly, setSuspiciousOnly] = useState(false)
  const manage = !!user && can.manageSecurity(user.role)

  const { data: eventsData } = useQuery({
    queryKey: ['security-events'],
    queryFn: () => api<{ events: SecurityEvent[] }>('/api/security/events?limit=120'),
    refetchInterval: 15000,
  })
  const { data: visitorsData } = useQuery({
    queryKey: ['visitors'],
    queryFn: () => api<{ visitors: VisitorLog[] }>('/api/security/visitors'),
    refetchInterval: 15000,
  })

  const events = (eventsData?.events ?? []).filter((e) => !suspiciousOnly || e.isSuspicious)
  const visitors = visitorsData?.visitors ?? []

  const checkout = async (id: string) => {
    try {
      await api(`/api/security/visitors/${id}/checkout`, { method: 'POST' })
      toast.success('Visitor checked out')
      queryClient.invalidateQueries({ queryKey: ['visitors'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <SecurityStats events={eventsData?.events ?? []} visitors={visitors} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'logs' | 'visitors')}>
          <TabsList>
            <TabsTrigger value="logs"><DoorClosed className="h-3.5 w-3.5" /> Access logs</TabsTrigger>
            <TabsTrigger value="visitors"><Users className="h-3.5 w-3.5" /> Visitor register</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {tab === 'logs' && (
            <Button variant={suspiciousOnly ? 'default' : 'outline'} size="sm"
              className={suspiciousOnly ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
              onClick={() => setSuspiciousOnly((v) => !v)}>
              <ShieldAlert className="h-3.5 w-3.5" /> Suspicious only
            </Button>
          )}
          {tab === 'visitors' && manage && <CheckInDialog onDone={() => queryClient.invalidateQueries({ queryKey: ['visitors'] })} />}
        </div>
      </div>

      {tab === 'logs' && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
              Simulated access-control devices at restricted areas · newest first
            </p>
            <SimBadge />
          </div>
          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Person</th>
                  <th className="px-4 py-2 font-medium hidden md:table-cell">Area</th>
                  <th className="px-4 py-2 font-medium hidden lg:table-cell">Credential</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.map((e) => (
                  <tr key={e.id} className={cn(e.isSuspicious && 'bg-red-500/[0.04]')}>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="tabular-nums">{timeStr(e.createdAt)}</span>
                      <span className="block text-[10px] text-muted-foreground">{relTime(e.createdAt)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{e.personName}</span>
                      <span className="block text-[11px] text-muted-foreground md:hidden">{e.zone} · {e.area}</span>
                      {e.detail && <span className="block text-[11px] text-muted-foreground">{e.detail}</span>}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span>{e.area}</span>
                      <span className="block text-[11px] text-muted-foreground">{e.zone}</span>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell font-mono text-xs text-muted-foreground">{e.credential}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Pill label={e.eventType} className={STATUS_STYLES[e.eventType]} />
                        {e.isSuspicious && <Pill label="SUSPICIOUS" className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" />}
                      </div>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No access events{suspiciousOnly ? ' flagged suspicious ' : ''} yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'visitors' && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-xs text-muted-foreground">Front-desk visitor register · pass issue &amp; exit tracking</p>
            <p className="text-xs text-muted-foreground">{visitors.filter((v) => v.status === 'INSIDE').length} inside</p>
          </div>
          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Pass</th>
                  <th className="px-4 py-2 font-medium">Visitor</th>
                  <th className="px-4 py-2 font-medium hidden md:table-cell">Purpose</th>
                  <th className="px-4 py-2 font-medium hidden lg:table-cell">Host · Zone</th>
                  <th className="px-4 py-2 font-medium">Checked in</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  {manage && <th className="px-4 py-2 font-medium text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visitors.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{v.passNo}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{v.visitorName}</span>
                      {v.phone && <span className="block text-[11px] text-muted-foreground">{v.phone}</span>}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">{v.purpose}</td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground">
                      {v.hostName}
                      {v.zone && <span className="block text-[11px]">{v.zone}</span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{dateTimeStr(v.checkInAt)}</td>
                    <td className="px-4 py-2.5"><Pill label={v.status} className={STATUS_STYLES[v.status]} /></td>
                    {manage && (
                      <td className="px-4 py-2.5 text-right">
                        {v.status === 'INSIDE' ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => checkout(v.id)}>
                            Check out
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">out {v.checkOutAt ? timeStr(v.checkOutAt) : ''}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {visitors.length === 0 && (
                  <tr><td colSpan={manage ? 7 : 6} className="px-4 py-10 text-center text-muted-foreground">No visitors recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!user && <p className="text-sm text-muted-foreground">Loading…</p>}
      {user && !can.viewSecurity(user.role) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-2 text-sm font-medium">Restricted view</p>
          <p className="text-xs text-muted-foreground">Security monitoring is available to staff, security personnel and administrators.</p>
        </div>
      )}
    </div>
  )
}

function CheckInDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ visitorName: '', phone: '', purpose: '', hostName: '', zone: '' })

  const submit = async () => {
    setSaving(true)
    try {
      await api('/api/security/visitors', { method: 'POST', json: form })
      toast.success(`Visitor checked in — pass issued`)
      setForm({ visitorName: '', phone: '', purpose: '', hostName: '', zone: '' })
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
          <UserPlus className="h-3.5 w-3.5" /> Check in visitor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Visitor check-in</DialogTitle>
          <DialogDescription>
            Issues a visitor pass and adds the entry to the campus register.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="v-name">Visitor name *</Label>
            <Input id="v-name" value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })} placeholder="e.g. Ramesh Gupta" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-phone">Phone</Label>
              <Input id="v-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" />
            </div>
            <div className="space-y-1.5">
              <Label>Zone</Label>
              <Select value={form.zone} onValueChange={(v) => setForm({ ...form, zone: v })}>
                <SelectTrigger><SelectValue placeholder="Visiting zone" /></SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-purpose">Purpose of visit *</Label>
            <Input id="v-purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. AC repair quotation" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-host">Host (person to meet) *</Label>
            <Input id="v-host" value={form.hostName} onChange={(e) => setForm({ ...form, hostName: e.target.value })} placeholder="e.g. Dr. Anil Rao" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.visitorName || !form.purpose || !form.hostName} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? 'Issuing pass…' : 'Issue pass & check in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
