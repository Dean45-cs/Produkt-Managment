'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ExportButton } from '@/components/ExportButton'
import { centsToEuro } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, Euro, Percent, Package, Users, Truck,
  AlertTriangle, Boxes, Timer, Coins, ShoppingBag, RotateCcw,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell, PieChart, Pie, AreaChart, Area,
} from 'recharts'
import type { ElementType } from 'react'

/* ----------------------------- Typen ----------------------------- */

interface RevenueData {
  history: Array<{ period: string; revenue: number; cost: number; profit: number; quantity: number }>
  forecast: Array<{ period: string; revenue: number; quantity: number }>
}

interface SupplierStat {
  supplierId: string; name: string; revenue: number; cost: number; profit: number
  quantity: number; settlementCount: number; deliveryCount: number; activeDeliveries: number
  productCount: number; avgPriceCt: number; marginPct: number
  unitsDelivered: number; openUnits: number; openReceivablesCt: number
  returnUnits: number; sellThroughPct: number; returnRatePct: number
  avgCycleDays: number | null; daysSinceLastDelivery: number | null
  lastSettledAt: string | null; lastDeliveryAt: string | null
}

interface ProductStat {
  id: string; name: string; sku: string; imageUrl?: string | null
  category?: { name: string; color?: string | null } | null
  purchasePriceCt: number; revenue: number; cost: number; profit: number
  quantity: number; avgPriceCt: number; marginPct: number; stock: number
  settlementCount: number; lastSold: string | null
}

interface Insights {
  kpis: {
    totalRevenueCt: number; totalCostCt: number; totalProfitCt: number; avgMarginPct: number
    unitsSold: number; settlementCount: number; avgOrderValueCt: number; deliveryCount: number
    unitsDelivered: number; sellThroughPct: number; returnUnits: number; returnRatePct: number
    inventoryValueCt: number; inventoryUnits: number; openReceivablesCt: number; openUnits: number
    deadStockValueCt: number; deadStockCount: number; reorderCount: number
    momGrowthPct: number | null; activeProducts: number; soldProducts: number
  }
  bestMonth: { period: string; revenue: number } | null
  worstMonth: { period: string; revenue: number } | null
  monthly: Array<{ period: string; revenue: number; cost: number; profit: number; units: number; settlements: number; marginPct: number; cumRevenue: number; cumProfit: number }>
  abc: Array<{ id: string; name: string; sku: string; categoryName: string | null; revenue: number; profit: number; units: number; marginPct: number; revenueSharePct: number; cumSharePct: number; class: string }>
  abcSummary: Array<{ class: string; productCount: number; revenue: number; revenueSharePct: number }>
  categories: Array<{ name: string; revenue: number; profit: number; units: number; marginPct: number }>
  invByCategory: Array<{ name: string; value: number; units: number }>
  invByLocation: Array<{ name: string; value: number; units: number }>
  deadStock: Array<{ id: string; name: string; sku: string; stock: number; valueCt: number; lastSold: string | null; daysSinceSold: number | null }>
  reorderList: Array<{ id: string; name: string; sku: string; stock: number; reorderPoint: number; reorderQty: number }>
  marginBuckets: Array<{ label: string; count: number }>
}

const PIE_COLORS = ['#e11d48', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']

/* ----------------------------- Helfer ----------------------------- */

const euro = (ct: number) => centsToEuro(ct)
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1)} %`)
const days = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1)} Tage`)

/** Einheitliche KPI-Kachel mit Symbol, Wert und Unterzeile. */
function Kpi({ icon: Icon, label, value, sub, tone = 'default' }: {
  icon: ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode
  tone?: 'default' | 'green' | 'red' | 'amber' | 'rose'
}) {
  const toneColor = {
    default: 'text-neutral-900',
    green: 'text-emerald-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
  }[tone]
  const iconBg = {
    default: 'bg-neutral-100 text-neutral-500',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  }[tone]
  return (
    <Card>
      <CardContent className="pt-5">
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
      </CardContent>
    </Card>
  )
}

/** Kurze Erklärzeile über einem Abschnitt. */
function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground mb-4">{children}</p>
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">{children}</div>
}

/* ----------------------------- Seite ----------------------------- */

export default function AnalyticsPage() {
  const { data: revData, isLoading } = useQuery<RevenueData>({
    queryKey: ['analytics-revenue'],
    queryFn: () => fetch('/api/analytics/revenue').then((r) => r.json()),
  })
  const { data: suppliers = [] } = useQuery<SupplierStat[]>({
    queryKey: ['analytics-suppliers'],
    queryFn: () => fetch('/api/analytics/suppliers').then((r) => r.json()),
  })
  const { data: products = [] } = useQuery<ProductStat[]>({
    queryKey: ['analytics-products'],
    queryFn: () => fetch('/api/analytics/products').then((r) => r.json()),
  })
  const { data: insights } = useQuery<Insights>({
    queryKey: ['analytics-insights'],
    queryFn: () => fetch('/api/analytics/insights').then((r) => r.json()),
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>

  const k = insights?.kpis

  /* -------- Übersicht-Charts -------- */
  const historyChart = revData?.history.map((h) => ({
    period: h.period, Umsatz: h.revenue / 100, Kosten: h.cost / 100, Gewinn: h.profit / 100,
  })) || []
  const forecastChart = [
    ...(revData?.history.slice(-3).map((h) => ({ period: h.period, Historisch: h.revenue / 100 })) || []),
    ...(revData?.forecast.map((f) => ({ period: f.period, Forecast: f.revenue / 100 })) || []),
  ]
  const cumulativeChart = insights?.monthly.map((m) => ({
    period: m.period, 'Umsatz kumuliert': m.cumRevenue / 100, 'Gewinn kumuliert': m.cumProfit / 100,
  })) || []

  const totalRevenue = revData?.history.reduce((s, h) => s + h.revenue, 0) || 0
  const totalProfit = revData?.history.reduce((s, h) => s + h.profit, 0) || 0
  const totalQty = revData?.history.reduce((s, h) => s + h.quantity, 0) || 0
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  /* -------- Verkäufer -------- */
  const topSeller = suppliers[0] // bereits nach Umsatz sortiert
  const bestMargin = [...suppliers].filter((s) => s.revenue > 0).sort((a, b) => b.marginPct - a.marginPct)[0]
  const fastestSeller = [...suppliers].filter((s) => s.avgCycleDays != null).sort((a, b) => (a.avgCycleDays! - b.avgCycleDays!))[0]
  const totalOpenReceivables = suppliers.reduce((s, x) => s + x.openReceivablesCt, 0)
  const totalOpenUnits = suppliers.reduce((s, x) => s + x.openUnits, 0)
  const sellerRevenueChart = suppliers.slice(0, 10).map((s) => ({ name: s.name, Umsatz: s.revenue / 100, Gewinn: s.profit / 100 }))
  const sellerCycleChart = suppliers.filter((s) => s.avgCycleDays != null).slice(0, 10)
    .map((s) => ({ name: s.name, Tage: Number(s.avgCycleDays!.toFixed(1)) }))

  /* -------- Produkte -------- */
  const sold = products.filter((p) => p.quantity > 0)
  const bestSeller = [...sold].sort((a, b) => b.quantity - a.quantity)[0]
  const topRevenue = [...sold].sort((a, b) => b.revenue - a.revenue)[0]
  const topProfit = [...sold].sort((a, b) => b.profit - a.profit)[0]
  const topRevenueChart = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 8)
    .map((p) => ({ name: p.name, Umsatz: p.revenue / 100, Gewinn: p.profit / 100 }))

  const abcColor: Record<string, string> = { A: 'text-emerald-700', B: 'text-amber-600', C: 'text-neutral-500' }
  const abcBadge: Record<string, 'success' | 'warning' | 'secondary'> = { A: 'success', B: 'warning', C: 'secondary' }

  return (
    <div>
      <PageHeader
        title="Analyse"
        description="Wie läuft dein Geschäft? Umsatz, deine Verkäufer im Außendienst, Produkte und Bestand auf einen Blick."
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="sellers">Verkäufer</TabsTrigger>
          <TabsTrigger value="products">Produkte</TabsTrigger>
          <TabsTrigger value="inventory">Bestand</TabsTrigger>
        </TabsList>

        {/* ===================== ÜBERSICHT ===================== */}
        <TabsContent value="overview">
          <SectionHint>Die wichtigsten Zahlen seit Beginn — was reinkommt, was hängen bleibt und wie es sich entwickelt.</SectionHint>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Kpi icon={Euro} label="Gesamtumsatz" value={euro(totalRevenue)} tone="rose" sub={`${totalQty} Stück verkauft`} />
            <Kpi icon={totalProfit >= 0 ? TrendingUp : TrendingDown} label="Gesamtgewinn" value={euro(totalProfit)} tone={totalProfit >= 0 ? 'green' : 'red'} />
            <Kpi icon={Percent} label="Ø Marge" value={`${avgMargin.toFixed(1)} %`} />
            <Kpi icon={ShoppingBag} label="Ø Abrechnung" value={euro(k?.avgOrderValueCt || 0)} sub={`${k?.settlementCount || 0} Abrechnungen`} />
          </div>

          {k && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Kpi
                icon={Truck}
                label="Abverkaufsquote"
                value={pct(k.sellThroughPct)}
                sub={`${k.unitsSold} von ${k.unitsDelivered} übergeben verkauft`}
                tone="green"
              />
              <Kpi
                icon={Coins}
                label="Ware beim Verkäufer"
                value={euro(k.openReceivablesCt)}
                sub={`${k.openUnits} Stück noch nicht abgerechnet`}
                tone="amber"
              />
              <Kpi
                icon={RotateCcw}
                label="Retourenquote"
                value={pct(k.returnRatePct)}
                sub={`${k.returnUnits} Stück zurück ins Lager`}
              />
              <Kpi
                icon={k.momGrowthPct != null && k.momGrowthPct >= 0 ? TrendingUp : TrendingDown}
                label="Wachstum z. Vormonat"
                value={k.momGrowthPct == null ? '—' : `${k.momGrowthPct >= 0 ? '+' : ''}${k.momGrowthPct.toFixed(1)} %`}
                tone={k.momGrowthPct == null ? 'default' : k.momGrowthPct >= 0 ? 'green' : 'red'}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader><CardTitle>Umsatz & Gewinn je Monat</CardTitle></CardHeader>
              <CardContent>
                {historyChart.length === 0 ? (
                  <EmptyHint>Noch keine Abrechnungsdaten vorhanden</EmptyHint>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={historyChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                      <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                      <Legend />
                      <Bar dataKey="Umsatz" fill="#e11d48" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Gewinn" fill="#10b981" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Umsatz-Prognose</CardTitle>
                  <Badge variant="info">nächste 3 Monate</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {forecastChart.length === 0 ? (
                  <EmptyHint>Zu wenig Daten für eine Prognose (mind. 2 Monate)</EmptyHint>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={forecastChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                      <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                      <Legend />
                      <Line type="monotone" dataKey="Historisch" stroke="#e11d48" strokeWidth={2} dot />
                      <Line type="monotone" dataKey="Forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Entwicklung über alle Monate</CardTitle></CardHeader>
            <CardContent>
              {cumulativeChart.length === 0 ? (
                <EmptyHint>Noch keine Daten</EmptyHint>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={cumulativeChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                    <Legend />
                    <Area type="monotone" dataKey="Umsatz kumuliert" stroke="#e11d48" fill="#fecdd3" strokeWidth={2} />
                    <Area type="monotone" dataKey="Gewinn kumuliert" stroke="#10b981" fill="#bbf7d0" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== VERKÄUFER ===================== */}
        <TabsContent value="sellers">
          <SectionHint>
            Deine Verkäufer holen alle 1–3 Tage eine Ladung ab und rechnen nach dem Verkauf ab.
            Hier siehst du, wer am meisten umsetzt, wie viel der Ware tatsächlich verkauft wird und
            wie schnell abgerechnet wird.
          </SectionHint>

          {suppliers.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Noch keine Verkaufsdaten. Lege eine Ladung an und erfasse den ersten Verkauf.
            </CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Kpi icon={Users} label="Top-Verkäufer (Umsatz)" value={topSeller?.name || '—'} sub={topSeller ? euro(topSeller.revenue) : undefined} tone="rose" />
                <Kpi icon={Percent} label="Beste Marge" value={bestMargin?.name || '—'} sub={bestMargin ? `${bestMargin.marginPct.toFixed(1)} %` : undefined} tone="green" />
                <Kpi icon={Timer} label="Schnellste Abrechnung" value={fastestSeller?.name || '—'} sub={fastestSeller ? days(fastestSeller.avgCycleDays) : undefined} />
                <Kpi icon={Coins} label="Ware unterwegs" value={euro(totalOpenReceivables)} sub={`${totalOpenUnits} Stück bei Verkäufern`} tone="amber" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader><CardTitle>Umsatz & Gewinn je Verkäufer</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(220, sellerRevenueChart.length * 48)}>
                      <BarChart data={sellerRevenueChart} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                        <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                        <Legend />
                        <Bar dataKey="Umsatz" fill="#e11d48" radius={[0, 2, 2, 0]} />
                        <Bar dataKey="Gewinn" fill="#10b981" radius={[0, 2, 2, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Ø Durchlaufzeit je Verkäufer</CardTitle>
                    <p className="text-sm text-muted-foreground">Tage von der Übergabe bis zur Abrechnung — kürzer ist besser.</p>
                  </CardHeader>
                  <CardContent>
                    {sellerCycleChart.length === 0 ? (
                      <EmptyHint>Noch keine abgerechneten Ladungen</EmptyHint>
                    ) : (
                      <ResponsiveContainer width="100%" height={Math.max(220, sellerCycleChart.length * 48)}>
                        <BarChart data={sellerCycleChart} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}T`} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                          <Tooltip formatter={(v) => `${Number(v).toFixed(1)} Tage`} />
                          <Bar dataKey="Tage" radius={[0, 2, 2, 0]}>
                            {sellerCycleChart.map((d, i) => (
                              <Cell key={i} fill={d.Tage <= 3 ? '#10b981' : d.Tage <= 6 ? '#f59e0b' : '#e11d48'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle>Verkäufer-Rangliste</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-2">Verkäufer</th>
                          <th className="text-right py-2 px-2">Umsatz</th>
                          <th className="text-right py-2 px-2">Gewinn</th>
                          <th className="text-right py-2 px-2">Marge</th>
                          <th className="text-right py-2 px-2">Ø-Preis</th>
                          <th className="text-right py-2 px-2">Verkauft</th>
                          <th className="text-right py-2 px-2">Abverkauf</th>
                          <th className="text-right py-2 px-2">Ø Durchlauf</th>
                          <th className="text-right py-2 px-2">Ware unterwegs</th>
                          <th className="text-right py-2 px-2">Letzte Abr.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map((s) => (
                          <tr key={s.supplierId} className="border-b hover:bg-neutral-50">
                            <td className="py-2 px-2 font-medium">{s.name}</td>
                            <td className="py-2 px-2 text-right font-medium">{euro(s.revenue)}</td>
                            <td className={`py-2 px-2 text-right ${s.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{euro(s.profit)}</td>
                            <td className="py-2 px-2 text-right">{s.revenue > 0 ? `${s.marginPct.toFixed(1)} %` : '—'}</td>
                            <td className="py-2 px-2 text-right text-rose-700 font-medium">{s.avgPriceCt > 0 ? euro(s.avgPriceCt) : '—'}</td>
                            <td className="py-2 px-2 text-right">{s.quantity}</td>
                            <td className="py-2 px-2 text-right">
                              {s.unitsDelivered > 0 ? (
                                <span className={s.sellThroughPct >= 80 ? 'text-emerald-600' : s.sellThroughPct >= 50 ? 'text-amber-600' : 'text-red-600'}>
                                  {s.sellThroughPct.toFixed(0)} %
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-2 px-2 text-right">{days(s.avgCycleDays)}</td>
                            <td className="py-2 px-2 text-right">
                              {s.openUnits > 0 ? (
                                <span className="text-amber-600 font-medium">{euro(s.openReceivablesCt)}</span>
                              ) : <Badge variant="success">0</Badge>}
                            </td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{formatDate(s.lastSettledAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ===================== PRODUKTE ===================== */}
        <TabsContent value="products">
          <SectionHint>Welche Produkte tragen dein Geschäft? Bestseller, Margen und der Beitrag jedes Produkts zum Umsatz.</SectionHint>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Kpi icon={Package} label="Bestseller (Menge)" value={bestSeller?.name || '—'} sub={bestSeller ? `${bestSeller.quantity} Stück` : undefined} />
            <Kpi icon={Euro} label="Umsatz-König" value={topRevenue?.name || '—'} sub={topRevenue ? euro(topRevenue.revenue) : undefined} tone="rose" />
            <Kpi icon={TrendingUp} label="Gewinn-König" value={topProfit?.name || '—'} sub={topProfit ? euro(topProfit.profit) : undefined} tone="green" />
            <Kpi icon={Boxes} label="Verkaufte Produkte" value={k?.soldProducts ?? 0} sub={`von ${k?.activeProducts ?? 0} aktiven`} />
          </div>

          {/* ABC-Analyse */}
          {insights && insights.abc.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Welche Produkte machen den Umsatz?</CardTitle>
                <p className="text-sm text-muted-foreground">ABC-Analyse: A = die wichtigsten Produkte (Top 80 % vom Umsatz), B = bis 95 %, C = der Rest.</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {insights.abcSummary.map((s) => (
                    <div key={s.class} className="rounded-lg border p-3 text-center">
                      <p className={`text-2xl font-bold ${abcColor[s.class]}`}>{s.class}</p>
                      <p className="text-xs text-muted-foreground">{s.productCount} Produkte</p>
                      <p className="text-sm font-medium mt-1">{euro(s.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{s.revenueSharePct.toFixed(0)} % vom Umsatz</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-2">Klasse</th>
                        <th className="text-left py-2 px-2">Produkt</th>
                        <th className="text-right py-2 px-2">Umsatz</th>
                        <th className="text-right py-2 px-2">Anteil</th>
                        <th className="text-right py-2 px-2">Kumuliert</th>
                        <th className="text-right py-2 px-2">Marge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.abc.slice(0, 20).map((p) => (
                        <tr key={p.id} className="border-b hover:bg-neutral-50">
                          <td className="py-2 px-2"><Badge variant={abcBadge[p.class]}>{p.class}</Badge></td>
                          <td className="py-2 px-2 font-medium"><Link href={`/products/${p.id}`} className="text-rose-600 hover:underline">{p.name}</Link></td>
                          <td className="py-2 px-2 text-right">{euro(p.revenue)}</td>
                          <td className="py-2 px-2 text-right">{p.revenueSharePct.toFixed(1)} %</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{p.cumSharePct.toFixed(1)} %</td>
                          <td className="py-2 px-2 text-right">{p.marginPct.toFixed(1)} %</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top 8 + Kategorie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader><CardTitle>Top 8 Produkte</CardTitle></CardHeader>
              <CardContent>
                {topRevenueChart.length === 0 ? (
                  <EmptyHint>Noch keine Verkaufsdaten</EmptyHint>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(220, topRevenueChart.length * 42)}>
                    <BarChart data={topRevenueChart} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                      <Legend />
                      <Bar dataKey="Umsatz" fill="#e11d48" radius={[0, 2, 2, 0]} />
                      <Bar dataKey="Gewinn" fill="#10b981" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Umsatz je Kategorie</CardTitle></CardHeader>
              <CardContent>
                {!insights || insights.categories.length === 0 ? (
                  <EmptyHint>Noch keine Kategorie-Daten</EmptyHint>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(220, insights.categories.length * 42)}>
                    <BarChart data={insights.categories.map((c) => ({ name: c.name, Umsatz: c.revenue / 100, Gewinn: c.profit / 100 }))} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                      <Legend />
                      <Bar dataKey="Umsatz" fill="#e11d48" radius={[0, 2, 2, 0]} />
                      <Bar dataKey="Gewinn" fill="#10b981" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Alle Produkte im Detail</CardTitle>
                <ExportButton href="/api/export/products" />
              </div>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Produkte vorhanden</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-2">Produkt</th>
                        <th className="text-left py-2 px-2">Kategorie</th>
                        <th className="text-right py-2 px-2">Bestand</th>
                        <th className="text-right py-2 px-2">Verkauft</th>
                        <th className="text-right py-2 px-2">Ø-Preis</th>
                        <th className="text-right py-2 px-2">EK-Preis</th>
                        <th className="text-right py-2 px-2">Umsatz</th>
                        <th className="text-right py-2 px-2">Gewinn</th>
                        <th className="text-right py-2 px-2">Marge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-neutral-50">
                          <td className="py-2 px-2">
                            <Link href={`/products/${p.id}`} className="flex items-center gap-2 font-medium text-rose-600 hover:underline">
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt={p.name} className="h-7 w-7 rounded object-cover border" />
                              ) : (
                                <span className="h-7 w-7 rounded bg-neutral-100 border flex items-center justify-center text-neutral-300"><Package className="h-3.5 w-3.5" /></span>
                              )}
                              {p.name}
                            </Link>
                          </td>
                          <td className="py-2 px-2">{p.category?.name || '—'}</td>
                          <td className="py-2 px-2 text-right">{p.stock}</td>
                          <td className="py-2 px-2 text-right">{p.quantity}</td>
                          <td className="py-2 px-2 text-right">{p.avgPriceCt > 0 ? euro(p.avgPriceCt) : '—'}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{euro(p.purchasePriceCt)}</td>
                          <td className="py-2 px-2 text-right font-medium">{euro(p.revenue)}</td>
                          <td className={`py-2 px-2 text-right ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{euro(p.profit)}</td>
                          <td className="py-2 px-2 text-right">{p.revenue > 0 ? `${p.marginPct.toFixed(1)} %` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== BESTAND ===================== */}
        <TabsContent value="inventory">
          <SectionHint>Was liegt im Lager, was muss nachbestellt werden und was bleibt liegen?</SectionHint>

          {k && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Kpi icon={Boxes} label="Bestandswert (EK)" value={euro(k.inventoryValueCt)} sub={`${k.inventoryUnits} Stück`} tone="rose" />
              <Kpi icon={AlertTriangle} label="Nachbestellen" value={k.reorderCount} sub="unter Meldebestand" tone={k.reorderCount > 0 ? 'red' : 'default'} />
              <Kpi icon={Timer} label="Ladenhüter" value={euro(k.deadStockValueCt)} sub={`${k.deadStockCount} Produkte > 90 Tage`} tone="amber" />
              <Kpi icon={Coins} label="Ware unterwegs" value={euro(k.openReceivablesCt)} sub={`${k.openUnits} Stück bei Verkäufern`} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader><CardTitle>Bestandswert je Kategorie</CardTitle></CardHeader>
              <CardContent>
                {!insights || insights.invByCategory.length === 0 ? (
                  <EmptyHint>Kein Bestand vorhanden</EmptyHint>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={insights.invByCategory.map((c) => ({ name: c.name, value: c.value / 100 }))}
                        dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                        label={(e) => `${e.name}`}
                      >
                        {insights.invByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Bestandswert je Standort</CardTitle></CardHeader>
              <CardContent>
                {!insights || insights.invByLocation.length === 0 ? (
                  <EmptyHint>Kein Bestand vorhanden</EmptyHint>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, insights.invByLocation.length * 48)}>
                    <BarChart data={insights.invByLocation.map((l) => ({ name: l.name, Wert: l.value / 100 }))} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                      <Bar dataKey="Wert" fill="#3b82f6" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" /> Nachbestellen</CardTitle>
                <p className="text-sm text-muted-foreground">Produkte auf oder unter dem Meldebestand — beim Lieferanten nachordern.</p>
              </CardHeader>
              <CardContent>
                {!insights || insights.reorderList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Alles ausreichend bevorratet 👍</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-2">Produkt</th>
                          <th className="text-right py-2 px-2">Bestand</th>
                          <th className="text-right py-2 px-2">Meldebestand</th>
                          <th className="text-right py-2 px-2">Vorschlag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.reorderList.map((p) => (
                          <tr key={p.id} className="border-b hover:bg-neutral-50">
                            <td className="py-2 px-2 font-medium"><Link href={`/products/${p.id}`} className="text-rose-600 hover:underline">{p.name}</Link></td>
                            <td className="py-2 px-2 text-right text-red-600 font-medium">{p.stock}</td>
                            <td className="py-2 px-2 text-right">{p.reorderPoint}</td>
                            <td className="py-2 px-2 text-right">{p.reorderQty > 0 ? `+${p.reorderQty}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Boxes className="h-4 w-4 text-amber-600" /> Ladenhüter</CardTitle>
                <p className="text-sm text-muted-foreground">Liegt im Lager, wurde aber seit über 90 Tagen nicht verkauft.</p>
              </CardHeader>
              <CardContent>
                {!insights || insights.deadStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Ladenhüter 👍</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-2">Produkt</th>
                          <th className="text-right py-2 px-2">Bestand</th>
                          <th className="text-right py-2 px-2">Wert</th>
                          <th className="text-right py-2 px-2">Zuletzt verkauft</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.deadStock.map((p) => (
                          <tr key={p.id} className="border-b hover:bg-neutral-50">
                            <td className="py-2 px-2 font-medium"><Link href={`/products/${p.id}`} className="text-rose-600 hover:underline">{p.name}</Link></td>
                            <td className="py-2 px-2 text-right">{p.stock}</td>
                            <td className="py-2 px-2 text-right">{euro(p.valueCt)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">
                              {p.daysSinceSold == null ? 'Nie' : `vor ${p.daysSinceSold} T.`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
