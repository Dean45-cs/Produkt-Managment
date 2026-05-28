'use client'

import { useQuery } from '@tanstack/react-query'
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
    default: 'text-blue-600',
    warning: 'text-yellow-600',
    success: 'text-green-600',
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
          title="Offene Abrechnungen"
          value={String(data?.pendingDeliveriesCount || 0)}
          icon={Truck}
          variant={data?.pendingDeliveriesCount ? 'warning' : 'default'}
          sub="Lieferungen noch nicht abgerechnet"
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
                    <Bar dataKey="Umsatz" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Kosten" fill="#f87171" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Gewinn" fill="#34d399" radius={[2, 2, 0, 0]} />
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
          <CardHeader><CardTitle>Offene Lieferungen (nicht abgerechnet)</CardTitle></CardHeader>
          <CardContent>
            {!data?.pendingDeliveries.length ? (
              <p className="text-sm text-muted-foreground">Keine offenen Lieferungen</p>
            ) : (
              <div className="space-y-2">
                {data.pendingDeliveries.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm p-2 rounded bg-yellow-50 border border-yellow-200">
                    <div>
                      <p className="font-medium">{d.supplier.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(d.createdAt)} · {d.items.reduce((s, i) => s + i.quantitySent, 0)} Stück</p>
                    </div>
                    <Badge variant="warning">Offen</Badge>
                  </div>
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
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
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
