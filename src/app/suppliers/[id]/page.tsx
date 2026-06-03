'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { centsToEuro } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_VARIANTS } from '@/lib/delivery'
import { SellerPortalCard } from '@/components/features/SellerPortalCard'
import { SellerAccessLog } from '@/components/features/SellerAccessLog'
import {
  ArrowLeft, Euro, TrendingUp, Percent, Timer, Truck, Coins, Mail, Phone, Plus,
} from 'lucide-react'
import type { ElementType } from 'react'

interface Overview {
  supplier: { id: string; name: string; contactName?: string | null; email?: string | null; phone?: string | null; address?: string | null; notes?: string | null }
  stats: {
    revenue: number; cost: number; profit: number; marginPct: number; avgPriceCt: number
    quantity: number; unitsDelivered: number; sellThroughPct: number; avgCycleDays: number | null
    openUnits: number; openValueCt: number; returnUnits: number; deliveryCount: number; settlementCount: number
  }
  deliveries: Array<{
    id: string; status: string; deliveryDate: string | null; createdAt: string
    totalSent: number; totalSettled: number; totalReturned: number; totalOpen: number
    settledAmountCt: number; openValueCt: number; daysOut: number | null; overdue: boolean
  }>
  settlements: Array<{ id: string; settledAt: string; totalAmountCt: number; qty: number }>
}

const euro = (ct: number) => centsToEuro(ct)
const days = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1)} Tage`)

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

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading } = useQuery<Overview>({
    queryKey: ['supplier-overview', id],
    queryFn: () => fetch(`/api/suppliers/${id}/overview`).then((r) => r.json()),
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>
  if (!data || !data.supplier) return <div className="p-4">Verkäufer nicht gefunden</div>

  const { supplier: s, stats, deliveries, settlements } = data
  const openDeliveries = deliveries.filter((d) => d.totalOpen > 0)
  const doneDeliveries = deliveries.filter((d) => d.totalOpen === 0)

  return (
    <div>
      <PageHeader
        title={s.name}
        description="Verkäufer im Außendienst"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/suppliers"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Zurück</Button></Link>
            <Link href="/deliveries/new"><Button><Plus className="h-4 w-4" /> Neue Ladung</Button></Link>
          </div>
        }
      />

      {/* Kontakt */}
      {(s.contactName || s.email || s.phone || s.address) && (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {s.contactName && <span>{s.contactName}</span>}
          {s.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {s.email}</span>}
          {s.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {s.phone}</span>}
          {s.address && <span>{s.address}</span>}
        </div>
      )}

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Kpi icon={Euro} label="Umsatz" value={euro(stats.revenue)} tone="rose" sub={`${stats.quantity} Stück verkauft`} />
        <Kpi icon={TrendingUp} label="Gewinn" value={euro(stats.profit)} tone={stats.profit >= 0 ? 'green' : 'red'} />
        <Kpi icon={Percent} label="Marge" value={stats.revenue > 0 ? `${stats.marginPct.toFixed(1)} %` : '—'} />
        <Kpi icon={Euro} label="Ø-Verkaufspreis" value={stats.avgPriceCt > 0 ? euro(stats.avgPriceCt) : '—'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi
          icon={Truck}
          label="Abverkaufsquote"
          value={stats.unitsDelivered > 0 ? `${stats.sellThroughPct.toFixed(0)} %` : '—'}
          sub={`${stats.quantity} von ${stats.unitsDelivered} übergeben`}
          tone="green"
        />
        <Kpi icon={Timer} label="Ø Durchlaufzeit" value={days(stats.avgCycleDays)} sub="Übergabe → Abrechnung" />
        <Kpi icon={Coins} label="Ware unterwegs" value={euro(stats.openValueCt)} sub={`${stats.openUnits} Stück offen`} tone={stats.openUnits > 0 ? 'amber' : 'default'} />
        <Kpi icon={Truck} label="Ladungen" value={stats.deliveryCount} sub={`${stats.settlementCount} Abrechnungen`} />
      </div>

      {/* Verkäufer-Portal-Zugang */}
      <SellerPortalCard supplierId={s.id} />

      {/* Zugriffs-Protokoll (nur Owner) */}
      <SellerAccessLog supplierId={s.id} />

      {/* Offene Ladungen */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Offene Ladungen
            {openDeliveries.length > 0 && <Badge variant="warning">{openDeliveries.length}</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Ware, die {s.name} aktuell hat und noch nicht abgerechnet ist.</p>
        </CardHeader>
        <CardContent>
          {openDeliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine offenen Ladungen — alles abgerechnet 👍</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Übergeben</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Offen</TableHead>
                  <TableHead className="text-right">Wert offen</TableHead>
                  <TableHead className="text-right">Tage draußen</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openDeliveries.map((d) => (
                  <TableRow key={d.id} className={d.overdue ? 'bg-red-50/50' : ''}>
                    <TableCell className="text-sm">{formatDate(d.deliveryDate || d.createdAt)}</TableCell>
                    <TableCell><Badge variant={DELIVERY_STATUS_VARIANTS[d.status]}>{DELIVERY_STATUS_LABELS[d.status]}</Badge></TableCell>
                    <TableCell className="text-right font-medium text-rose-600">{d.totalOpen} / {d.totalSent}</TableCell>
                    <TableCell className="text-right">{euro(d.openValueCt)}</TableCell>
                    <TableCell className="text-right">
                      {d.daysOut == null ? '—' : d.overdue
                        ? <span className="font-semibold text-red-600">{d.daysOut} T. ⚠</span>
                        : <span>{d.daysOut} T.</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/deliveries/${d.id}`}><Button variant="ghost" size="sm">Öffnen</Button></Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Letzte Abrechnungen */}
        <Card>
          <CardHeader><CardTitle>Letzte Abrechnungen</CardTitle></CardHeader>
          <CardContent>
            {settlements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Abrechnungen.</p>
            ) : (
              <div className="space-y-2">
                {settlements.map((st) => (
                  <Link key={st.id} href={`/settlements/${st.id}`}>
                    <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{formatDate(st.settledAt)}</p>
                        <p className="text-xs text-muted-foreground">{st.qty} Stück verkauft</p>
                      </div>
                      <span className="font-bold text-green-600">{euro(st.totalAmountCt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Abgeschlossene Ladungen */}
        <Card>
          <CardHeader><CardTitle>Abgeschlossene Ladungen</CardTitle></CardHeader>
          <CardContent>
            {doneDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine abgeschlossenen Ladungen.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Übergeben</TableHead>
                    <TableHead className="text-right">Stück</TableHead>
                    <TableHead className="text-right">Erlös</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doneDeliveries.slice(0, 10).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm">{formatDate(d.deliveryDate || d.createdAt)}</TableCell>
                      <TableCell className="text-right">{d.totalSettled}{d.totalReturned > 0 ? ` (+${d.totalReturned} R)` : ''}</TableCell>
                      <TableCell className="text-right text-green-600">{euro(d.settledAmountCt)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/deliveries/${d.id}`}><Button variant="ghost" size="sm">Öffnen</Button></Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
