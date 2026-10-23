'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useUserStore } from '@/lib/user-store'
import { useLiveStore } from '@/lib/live-store'
import { can } from '@/lib/permissions'
import type { Alert } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pill, SEVERITY_STYLES, relTime } from '@/components/shared'
import { AlertTriangle, Bell, Check, CheckCheck, Siren } from 'lucide-react'

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  CRITICAL: <Siren className="h-4 w-4 text-red-500" />,
  HIGH: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  MEDIUM: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  INFO: <Bell className="h-4 w-4 text-sky-500" />,
}

export function AlertsCenter() {
  const user = useUserStore((s) => s.user)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'ACTIVE' | 'ALL'>('ACTIVE')
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['alerts', 'center', tab],
    queryFn: () => api<{ alerts: Alert[] }>(`/api/alerts?status=${tab}&limit=40`),
    refetchInterval: 15000,
  })

  const alerts = data?.alerts ?? []
  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length

  const act = async (id: string, action: 'ack' | 'resolve') => {
    try {
      await api(`/api/alerts/${id}`, { method: 'POST', json: { action } })
      toast.success(action === 'ack' ? 'Alert acknowledged' : 'Alert resolved')
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Alert notifications">
          <Bell className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 sm:w-[420px]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Alert center</p>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'ACTIVE' | 'ALL')}>
            <TabsList className="h-7">
              <TabsTrigger value="ACTIVE" className="text-xs px-2.5">Active</TabsTrigger>
              <TabsTrigger value="ALL" className="text-xs px-2.5">History</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ScrollArea className="h-[380px]">
          <div className="divide-y">
            {alerts.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">No alerts — all clear.</p>
            )}
            {alerts.map((a) => (
              <div key={a.id} className="flex gap-3 px-4 py-3">
                <div className="mt-0.5">{SEVERITY_ICON[a.severity] ?? SEVERITY_ICON.INFO}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium leading-tight">{a.title}</p>
                    <Pill label={a.severity} className={SEVERITY_STYLES[a.severity]} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{a.message}</p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-muted-foreground">{relTime(a.createdAt)}</span>
                    <Pill label={a.status} className={SEVERITY_STYLES[a.status]} />
                    {a.acknowledgedBy && <span className="text-[11px] text-muted-foreground">by {a.acknowledgedBy}</span>}
                  </div>
                  {a.status !== 'RESOLVED' && user && (
                    <div className="mt-2 flex gap-2">
                      {a.status === 'ACTIVE' && can.ackAlert(user.role) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => act(a.id, 'ack')}>
                          <Check className="h-3 w-3" /> Acknowledge
                        </Button>
                      )}
                      {can.resolveAlert(user.role) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400" onClick={() => act(a.id, 'resolve')}>
                          <CheckCheck className="h-3 w-3" /> Resolve
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

/** Red screen-edge flash rendered app-wide for CRITICAL events. */
export function CriticalFlash() {
  const criticalFlashAt = useLiveStore((s) => s.criticalFlashAt)
  if (!criticalFlashAt) return null
  return (
    <div
      key={criticalFlashAt}
      className={cn(
        'pointer-events-none fixed inset-0 z-[100] animate-out fade-out duration-[2500ms]',
        'ring-[6px] ring-inset ring-red-500/70',
      )}
    />
  )
}
