'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { centsToEuro } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_VARIANTS } from '@/lib/delivery'
import { Coins, AlertTriangle, Users, CheckCircle2 } from 'lucide-react'
import type { ElementType } from 'react'

interface OpenDelivery {
  id: string; deliveryDate: string | null; createdAt: string
  daysOut: number; openUnits: number; openValueCt: number; status: string; overdue: boolean
}
interface SupplierBucket {
  supplierId: string; name: string
  openUnits: number; openValueCt: number; oldestDaysOut: number; overdue: boolean
  deliveries: OpenDelivery[]
}
interface Receivables {
  suppliers: SupplierBucket[]
  totalOpenValueCt: number
  totalOpenUnits: number
  overdueCount: number
  sellerCount: number
}

const euro = (ct: number) => centsToEuro(ct)

function Kpi({ icon: Icon, label, value, sub, tone = 'default' }: {
  icon: ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode
  tone?: 'default' | 'green' | 'red' | 'amber' | 'rose'
}) {
  const toneColor = { default: 'text-neutral-900', green: 'text-emerald-600', red: 'text-red-600', amber: 'text-amber-600', rose: 'text-rose-600' }[tone]
  const iconBg = { default: 'bg-neutral-100 text-neutral-500', green: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600' }[tone]
  return (
    <Card><CardContent className="pt-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold mt-0.5 truncate ${toneColor}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${iconBg}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </CardContent></Card>
  )
}

export default function ReceivablesPage() {
  const { data, isLoading } = useQuery<Receivables>({
    queryKey: ['receivables'],
    queryFn: () => fetch('/api/receivables').then((r) => r.json()),
  })

  return (
    <div>
      <PageHeader
        title="Offene Posten"
        description="Welche Ware liegt noch bei deinen Verkäufern und ist nicht abgerechnet? Ladungen über 3 Tage gelten als überfällig."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={Coins} label="Ware unterwegs (Wert)" value={euro(data?.totalOpenValueCt || 0)} tone="amber" />
        <Kpi icon={Coins} label="Stück unterwegs" value={data?.totalOpenUnits || 0} />
        <Kpi icon={Users} label="Verkäufer mit offener Ware" value={data?.sellerCount || 0} />
        <Kpi
          icon={AlertTriangle}
          label="Überfällige Ladungen"
          value={data?.overdueCount || 0}
          sub="> 3 Tage draußen"
          tone={(data?.overdueCount || 0) > 0 ? 'red' : 'green'}
        />
      </div>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Laden...</CardContent></Card>
      ) : !data || data.suppliers.length === 0 ? (
        <Card><CardContent className="p-0">
          <EmptyState
            icon={CheckCircle2}
            title="Keine offenen Posten"
            description="Aktuell liegt keine Ware bei einem Verkäufer offen — alles ist abgerechnet."
            actionHref="/deliveries/new"
            actionLabel="Neue Ladung anlegen"
          />
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {data.suppliers.map((s) => (
            <Card key={s.supplierId} className={s.overdue ? 'border-red-200' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="flex items-center gap-2">
                    <Link href={`/suppliers/${s.supplierId}`} className="text-rose-600 hover:underline">{s.name}</Link>
                    {s.overdue && <Badge variant="destructive">überfällig</Badge>}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{s.openUnits} Stück</span>
                    <span className="font-bold text-amber-600">{euro(s.openValueCt)}</span>
                    <Link href={`/suppliers/${s.supplierId}`}><Button variant="outline" size="sm">Details</Button></Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {s.deliveries.map((d) => (
                    <Link key={d.id} href={`/deliveries/${d.id}`}>
                      <div className={`flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors ${d.overdue ? 'border-red-200 bg-red-50/40' : ''}`}>
                        <div className="flex items-center gap-3">
                          <Badge variant={DELIVERY_STATUS_VARIANTS[d.status]}>{DELIVERY_STATUS_LABELS[d.status]}</Badge>
                          <div>
                            <p className="text-sm font-medium">{formatDate(d.deliveryDate || d.createdAt)}</p>
                            <p className="text-xs text-muted-foreground">{d.openUnits} Stück offen</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-sm ${d.overdue ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                            {d.daysOut} Tage{d.overdue ? ' ⚠' : ''}
                          </span>
                          <span className="font-medium text-amber-600 w-20 text-right">{euro(d.openValueCt)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
