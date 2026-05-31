'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { centsToEuro } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { TrendingUp, Package, AlertTriangle, Euro, Truck, TrendingDown } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface DashboardData {
  totalInventoryValue: number
  pendingDeliveriesCount: number
  pendingDeliveries: Array<{
    id: string
    supplier: { name: string }
    createdAt: string
    items: Array<{ quantitySent: number }>
  }>
  monthRevenue: number
  monthProfit: number
  lowStockCount: number
  lowStockProducts: Array<{
    id: string
    name: string
    currentStock: number
    reorderPoint: number
    reorderQty: number
  }>
  monthlyRevenue: Array<{ period: string; revenue: number; cost: number }>
  topProducts: Array<{ name: string; revenue: number; quantity: number }>
}

function KpiCard({
  title,
  value,
  icon: Icon,
  sub,
  variant = 'default',
}: {
  title: string
  value: string
  icon: React.ElementType
  sub?: string
  variant?: 'default' | 'warning' | 'success' | 'danger'
}) {
  const colors = {
    default: 'text-rose-600',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
    danger: 'text-red-600',
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <Icon className={`h-5 w-5 ${colors[variant]}`} />
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then((r) => r.json()),
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="pt-6 h-24 animate-pulse bg-gray-100 rounded" /></Card>
          ))}
        </div>
      </div>
    )
  }

  const chartData = data?.monthlyRevenue.map((m) => ({
    period: m.period,
    Umsatz: m.revenue / 100,
    Kosten: m.cost / 100,
    Gewinn: (m.revenue - m.cost) / 100,
  })) || []

  return (
    <div>
      <PageHeader title="Dashboard" description="Übersicht über Bestand, Umsatz und offene Posten" />

      {data?.lowStockCount ? (
        <Link
          href="/products"
          className="flex items-center gap-3 mb-6 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 hover:bg-yellow-100 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">{data.lowStockCount} Produkt{data.lowStockCount === 1 ? '' : 'e'}</span>
            {' '}unter dem Nachbestellpunkt
            {data.lowStockProducts.length > 0 && (
              <span className="text-yellow-700">
                {' '}— z.B. {data.lowStockProducts.slice(0, 3).map((p) => p.name).join(', ')}
                {data.lowStockProducts.length > 3 ? ` +${data.lowStockProducts.length - 3} weitere` : ''}
              </span>
            )}
          </div>
          <span className="font-medium underline whitespace-nowrap">Jetzt prüfen →</span>
        </Link>
      ) : null}

      {/* Workflow-Leitfaden */}
      <div className="mb-6 rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-muted/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dein Arbeitsablauf</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="mt-0.5 w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <div>
              <p className="font-semibold text-sm">Einkauf beim Großhändler</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ware bestellen → beim Empfang steigt dein Bestand</p>
              <Link href="/purchase-orders/new" className="mt-1.5 inline-block text-xs text-rose-600 font-medium hover:underline">+ Neue Bestellung →</Link>
            </div>
          </div>
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="mt-0.5 w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <div>
              <p className="font-semibold text-sm">Ladung an Verkäufer</p>
              <p className="text-xs text-muted-foreground mt-0.5">Verkäufer holt Ware ab → Bestand sinkt sofort bei Übergabe</p>
              <Link href="/deliveries/new" className="mt-1.5 inline-block text-xs text-rose-600 font-medium hover:underline">+ Neue Ladung →</Link>
            </div>
          </div>
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="mt-0.5 w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
            <div>
              <p className="font-semibold text-sm">Verkauf abrechnen</p>
              <p className="text-xs text-muted-foreground mt-0.5">Verkäufer zahlt & meldet Stück → Gewinn wird berechnet</p>
              <Link href="/deliveries" className="mt-1.5 inline-block text-xs text-rose-600 font-medium hover:underline">Zu den Ladungen →</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Bestandswert"
          value={centsToEuro(data?.totalInventoryValue || 0)}
          icon={Package}
          sub="Einkaufspreise × Menge"
        />
        <KpiCard
          title="Umsatz (Monat)"
          value={centsToEuro(data?.monthRevenue || 0)}
          icon={Euro}
          variant="success"
        />
        <KpiCard
          title="Gewinn (Monat)"
          value={centsToEuro(data?.monthProfit || 0)}
          icon={data?.monthProfit && data.monthProfit > 0 ? TrendingUp : TrendingDown}
          variant={data?.monthProfit && data.monthProfit > 0 ? 'success' : 'danger'}
        />
        <KpiCard
          title="Offene Ladungen"
          value={String(data?.pendingDeliveriesCount || 0)}
          icon={Truck}
          variant={data?.pendingDeliveriesCount ? 'warning' : 'default'}
          sub="Noch nicht vollständig abgerechnet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Umsatz & Gewinn (letzte 12 Monate)</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Noch keine Abrechnungsdaten vorhanden
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                    <Legend />
                    <Bar dataKey="Umsatz" fill="#e11d48" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Kosten" fill="#71717a" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Gewinn" fill="#10b981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Niedrige Bestände ({data?.lowStockCount || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.lowStockProducts.length ? (
                <p className="text-sm text-muted-foreground">Alle Bestände ausreichend</p>
              ) : (
                <div className="space-y-2">
                  {data.lowStockProducts.slice(0, 6).map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{p.name}</span>
                      <Badge variant="warning">{p.currentStock} / {p.reorderPoint}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Offene Ladungen (noch nicht vollständig abgerechnet)</CardTitle></CardHeader>
          <CardContent>
            {!data?.pendingDeliveries.length ? (
              <p className="text-sm text-muted-foreground">Keine offenen Ladungen</p>
            ) : (
              <div className="space-y-2">
                {data.pendingDeliveries.map((d) => (
                  <Link key={d.id} href={`/deliveries/${d.id}`}>
                    <div className="flex items-center justify-between text-sm p-2 rounded bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition-colors cursor-pointer">
                      <div>
                        <p className="font-medium">{d.supplier.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(d.createdAt)} · {d.items.reduce((s, i) => s + i.quantitySent, 0)} Stück</p>
                      </div>
                      <Badge variant="warning">Abrechnen →</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top Produkte diesen Monat</CardTitle></CardHeader>
          <CardContent>
            {!data?.topProducts.length ? (
              <p className="text-sm text-muted-foreground">Noch keine Daten diesen Monat</p>
            ) : (
              <div className="space-y-2">
                {data.topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                      <span>{p.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{centsToEuro(p.revenue)}</div>
                      <div className="text-xs text-muted-foreground">{p.quantity} Stück</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
