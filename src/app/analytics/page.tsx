'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StarRating } from '@/components/ui/star-rating'
import { ExportButton } from '@/components/ExportButton'
import { centsToEuro } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { Trophy, Package, AlertTriangle, Boxes } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell, PieChart, Pie, AreaChart, Area,
} from 'recharts'

interface RevenueData {
  history: Array<{ period: string; revenue: number; cost: number; profit: number; quantity: number }>
  forecast: Array<{ period: string; revenue: number; quantity: number }>
}

interface SupplierStat {
  supplierId: string; name: string; revenue: number; cost: number; profit: number
  quantity: number; settlementCount: number; deliveryCount: number; productCount: number
  avgPriceCt: number; marginPct: number; lastSettledAt: string | null
}

interface SupplierBreakdown {
  supplierId: string; supplierName: string
  revenue: number; cost: number; profit: number; units: number
  avgPriceCt: number; marginPct: number
}

interface ProductStat {
  id: string; name: string; sku: string; imageUrl?: string | null
  category?: { name: string; color?: string | null } | null
  purchasePriceCt: number; revenue: number; cost: number; profit: number
  quantity: number; avgPriceCt: number; marginPct: number; stock: number
  settlementCount: number; ratingAvg: number; ratingCount: number; lastSold: string | null
  supplierBreakdown: SupplierBreakdown[]
}

interface Review {
  id: string; rating: number; comment?: string | null; customerName?: string | null
  createdAt: string; product: { id: string; name: string; sku: string }
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
  productBySupplier: Array<{
    productId: string; productName: string; productSku: string
    supplierId: string; supplierName: string
    revenue: number; cost: number; profit: number; units: number
    avgPriceCt: number; marginPct: number
  }>
}

const PIE_COLORS = ['#e11d48', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']

function KpiCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string }) {
  return (
    <Card><CardContent className="pt-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${accent || ''}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent></Card>
  )
}

const euro = (ct: number) => centsToEuro(ct)
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1)}%`)

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
  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ['analytics-reviews'],
    queryFn: () => fetch('/api/reviews').then((r) => r.json()),
  })
  const { data: insights } = useQuery<Insights>({
    queryKey: ['analytics-insights'],
    queryFn: () => fetch('/api/analytics/insights').then((r) => r.json()),
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>

  const k = insights?.kpis

  // ---- Übersicht-Charts ----
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

  // ---- Produkte ----
  const sold = products.filter((p) => p.quantity > 0)
  const bestSeller = [...sold].sort((a, b) => b.quantity - a.quantity)[0]
  const topRevenue = [...sold].sort((a, b) => b.revenue - a.revenue)[0]
  const topProfit = [...sold].sort((a, b) => b.profit - a.profit)[0]
  const rated = products.filter((p) => p.ratingCount > 0)
  const bestRated = [...rated].sort((a, b) => b.ratingAvg - a.ratingAvg)[0]
  const topRevenueChart = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 8)
    .map((p) => ({ name: p.name, Umsatz: p.revenue / 100, Gewinn: p.profit / 100 }))

  // ---- Bewertungen ----
  const totalReviews = reviews.length
  const overallAvg = totalReviews > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / totalReviews : 0
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star: `${star} ★`, Anzahl: reviews.filter((r) => r.rating === star).length,
  }))
  const bestRatedList = [...rated].sort((a, b) => b.ratingAvg - a.ratingAvg).slice(0, 5)
  const worstRatedList = [...rated].sort((a, b) => a.ratingAvg - b.ratingAvg).slice(0, 5)

  const abcColor: Record<string, string> = { A: 'text-green-700', B: 'text-amber-600', C: 'text-neutral-500' }
  const abcBadge: Record<string, 'success' | 'warning' | 'secondary'> = { A: 'success', B: 'warning', C: 'secondary' }

  return (
    <div>
      <PageHeader
        title="Analyse & Forecast"
        description="Umsatz, Produkte, Lieferanten, Bestand und Kundenzufriedenheit im Detail"
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="products">Produkte</TabsTrigger>
          <TabsTrigger value="inventory">Bestand</TabsTrigger>
          <TabsTrigger value="suppliers">Lieferanten</TabsTrigger>
          <TabsTrigger value="reviews">Bewertungen</TabsTrigger>
        </TabsList>

        {/* ===================== ÜBERSICHT ===================== */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiCard label="Gesamtumsatz" value={euro(totalRevenue)} accent="text-rose-600" />
            <KpiCard label="Gesamtgewinn" value={euro(totalProfit)} accent={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'} />
            <KpiCard label="Ø Marge" value={`${avgMargin.toFixed(1)}%`} />
            <KpiCard label="Verkaufte Stück" value={totalQty} />
          </div>

          {k && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <KpiCard label="Ø Bestellwert" value={euro(k.avgOrderValueCt)} sub={`${k.settlementCount} Abrechnungen`} />
              <KpiCard
                label="Abverkaufsquote"
                value={pct(k.sellThroughPct)}
                sub={`${k.unitsSold} von ${k.unitsDelivered} geliefert`}
              />
              <KpiCard
                label="Wachstum (MoM)"
                value={k.momGrowthPct == null ? '—' : (
                  <span className={k.momGrowthPct >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {k.momGrowthPct >= 0 ? '▲' : '▼'} {Math.abs(k.momGrowthPct).toFixed(1)}%
                  </span>
                )}
                sub="ggü. Vormonat"
              />
              <KpiCard label="Offene Forderungen" value={euro(k.openReceivablesCt)} sub={`${k.openUnits} Stück unterwegs`} accent="text-amber-600" />
            </div>
          )}

          {k && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard label="Bestandswert" value={euro(k.inventoryValueCt)} sub={`${k.inventoryUnits} Stück`} />
              <KpiCard label="Retourenquote" value={pct(k.returnRatePct)} sub={`${k.returnUnits} retourniert`} />
              <KpiCard label="Bester Monat" value={insights?.bestMonth?.period || '—'} sub={insights?.bestMonth ? euro(insights.bestMonth.revenue) : undefined} accent="text-green-700 text-base" />
              <KpiCard label="Schwächster Monat" value={insights?.worstMonth?.period || '—'} sub={insights?.worstMonth ? euro(insights.worstMonth.revenue) : undefined} accent="text-base" />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader><CardTitle>Umsatz & Gewinn je Monat</CardTitle></CardHeader>
              <CardContent>
                {historyChart.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Noch keine Abrechnungsdaten vorhanden</div>
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
                  <CardTitle>Umsatz-Forecast</CardTitle>
                  <Badge variant="info">3-Monats-Prognose</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {forecastChart.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Zu wenig Daten für Forecast (mind. 2 Monate)</div>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader><CardTitle>Kumulierter Umsatz & Gewinn</CardTitle></CardHeader>
              <CardContent>
                {cumulativeChart.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Noch keine Daten</div>
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

            <Card>
              <CardHeader><CardTitle>Margenverteilung der Produkte</CardTitle></CardHeader>
              <CardContent>
                {!insights || insights.marginBuckets.every((b) => b.count === 0) ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Noch keine Verkaufsdaten</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={insights.marginBuckets}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Produkte" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Monatsdetails</CardTitle></CardHeader>
            <CardContent>
              {(insights?.monthly.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Daten</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Monat</th>
                        <th className="text-right py-2 px-2">Umsatz</th>
                        <th className="text-right py-2 px-2">Kosten</th>
                        <th className="text-right py-2 px-2">Gewinn</th>
                        <th className="text-right py-2 px-2">Marge</th>
                        <th className="text-right py-2 px-2">Stück</th>
                        <th className="text-right py-2 px-2">Abr.</th>
                        <th className="text-right py-2 px-2">Umsatz kum.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights?.monthly.map((h) => (
                        <tr key={h.period} className="border-b hover:bg-neutral-50">
                          <td className="py-2 px-2 font-medium">{h.period}</td>
                          <td className="py-2 px-2 text-right">{euro(h.revenue)}</td>
                          <td className="py-2 px-2 text-right">{euro(h.cost)}</td>
                          <td className={`py-2 px-2 text-right font-medium ${h.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{euro(h.profit)}</td>
                          <td className="py-2 px-2 text-right">{h.marginPct.toFixed(1)}%</td>
                          <td className="py-2 px-2 text-right">{h.units}</td>
                          <td className="py-2 px-2 text-right">{h.settlements}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{euro(h.cumRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== PRODUKTE ===================== */}
        <TabsContent value="products">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard label="🏆 Bestseller (Menge)" value={bestSeller?.name || '—'} sub={bestSeller ? `${bestSeller.quantity} Stück` : undefined} accent="text-base" />
            <KpiCard label="💰 Umsatz-König" value={topRevenue?.name || '—'} sub={topRevenue ? euro(topRevenue.revenue) : undefined} accent="text-base" />
            <KpiCard label="📈 Gewinn-König" value={topProfit?.name || '—'} sub={topProfit ? euro(topProfit.profit) : undefined} accent="text-base" />
            <KpiCard label="⭐ Bestbewertet" value={bestRated?.name || '—'} sub={bestRated ? `${bestRated.ratingAvg.toFixed(1)} ★ (${bestRated.ratingCount})` : undefined} accent="text-base" />
          </div>

          {/* ABC-Analyse */}
          {insights && insights.abc.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>ABC-Analyse (Pareto)</CardTitle>
                <p className="text-sm text-muted-foreground">Welche Produkte tragen den Großteil des Umsatzes? A = Top 80 %, B = bis 95 %, C = Rest.</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {insights.abcSummary.map((s) => (
                    <div key={s.class} className="rounded-lg border p-3 text-center">
                      <p className={`text-2xl font-bold ${abcColor[s.class]}`}>{s.class}</p>
                      <p className="text-xs text-muted-foreground">{s.productCount} Produkte</p>
                      <p className="text-sm font-medium mt-1">{euro(s.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{s.revenueSharePct.toFixed(0)}% vom Umsatz</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
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
                          <td className="py-2 px-2 text-right">{p.revenueSharePct.toFixed(1)}%</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{p.cumSharePct.toFixed(1)}%</td>
                          <td className="py-2 px-2 text-right">{p.marginPct.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Kategorie-Performance */}
          {insights && insights.categories.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader><CardTitle>Umsatz je Kategorie</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(200, insights.categories.length * 42)}>
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
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Kategorien im Detail</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Kategorie</th>
                          <th className="text-right py-2 px-2">Umsatz</th>
                          <th className="text-right py-2 px-2">Gewinn</th>
                          <th className="text-right py-2 px-2">Marge</th>
                          <th className="text-right py-2 px-2">Stück</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.categories.map((c) => (
                          <tr key={c.name} className="border-b hover:bg-neutral-50">
                            <td className="py-2 px-2 font-medium">{c.name}</td>
                            <td className="py-2 px-2 text-right">{euro(c.revenue)}</td>
                            <td className={`py-2 px-2 text-right ${c.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{euro(c.profit)}</td>
                            <td className="py-2 px-2 text-right">{c.marginPct.toFixed(1)}%</td>
                            <td className="py-2 px-2 text-right">{c.units}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Lieferanten-Vergleich je Produkt */}
          {(() => {
            const pbs = insights?.productBySupplier
            if (!pbs?.length) return null
            const grouped = new Map<string, typeof pbs>()
            for (const e of pbs) {
              const list = grouped.get(e.productId) ?? []
              list.push(e)
              grouped.set(e.productId, list)
            }
            const multiSupplier = Array.from(grouped.values())
              .filter((g) => g.length > 1)
              .sort((a, b) => b.reduce((s, e) => s + e.revenue, 0) - a.reduce((s, e) => s + e.revenue, 0))
            if (multiSupplier.length === 0) return null
            return (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Lieferanten-Vergleich je Produkt</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {multiSupplier.length} Produkt{multiSupplier.length !== 1 ? 'e' : ''} werden über mehrere Lieferanten abgerechnet — Preis- und Margenvergleich.
                    Grün markiert = besserer Durchschnittspreis.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {multiSupplier.map((entries) => {
                      const { productId, productName, productSku } = entries[0]
                      const sorted = [...entries].sort((a, b) => b.avgPriceCt - a.avgPriceCt)
                      const chartData = sorted.map((e) => ({
                        name: e.supplierName,
                        'Ø-Preis': e.avgPriceCt / 100,
                      }))
                      return (
                        <div key={productId} className="rounded-lg border p-4">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <Link href={`/products/${productId}`} className="font-semibold text-rose-600 hover:underline">
                              {productName}
                            </Link>
                            <span className="text-xs text-muted-foreground">{productSku}</span>
                            <Badge variant="info" className="ml-auto">{entries.length} Lieferanten</Badge>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ResponsiveContainer width="100%" height={Math.max(140, sorted.length * 52)}>
                              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                                <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                                <Bar dataKey="Ø-Preis" radius={[0, 2, 2, 0]}>
                                  {sorted.map((_, i) => (
                                    <Cell key={i} fill={i === 0 ? '#10b981' : '#e11d48'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-1.5 px-2">Lieferant</th>
                                    <th className="text-right py-1.5 px-2">Ø-Preis</th>
                                    <th className="text-right py-1.5 px-2">Stück</th>
                                    <th className="text-right py-1.5 px-2">Umsatz</th>
                                    <th className="text-right py-1.5 px-2">Marge</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sorted.map((e, i) => (
                                    <tr key={e.supplierId} className={`border-b ${i === 0 ? 'bg-green-50' : ''}`}>
                                      <td className="py-1.5 px-2 font-medium">
                                        {i === 0 && <span className="text-green-600 mr-1 text-xs">▲</span>}
                                        {e.supplierName}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-medium text-rose-700">{euro(e.avgPriceCt)}</td>
                                      <td className="py-1.5 px-2 text-right">{e.units}</td>
                                      <td className="py-1.5 px-2 text-right">{euro(e.revenue)}</td>
                                      <td className="py-1.5 px-2 text-right">{e.marginPct.toFixed(1)}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          <Card className="mb-6">
            <CardHeader><CardTitle>Top 8 Produkte nach Umsatz & Gewinn</CardTitle></CardHeader>
            <CardContent>
              {topRevenueChart.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Verkaufsdaten</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, topRevenueChart.length * 42)}>
                  <BarChart data={topRevenueChart} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
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
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Produkt</th>
                        <th className="text-left py-2 px-2">Kategorie</th>
                        <th className="text-right py-2 px-2">Bestand</th>
                        <th className="text-right py-2 px-2">Verkauft</th>
                        <th className="text-right py-2 px-2">Ø-Preis</th>
                        <th className="text-right py-2 px-2">Umsatz</th>
                        <th className="text-right py-2 px-2">Gewinn</th>
                        <th className="text-right py-2 px-2">Marge</th>
                        <th className="text-left py-2 px-2">Bewertung</th>
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
                          <td className="py-2 px-2 text-right font-medium">{euro(p.revenue)}</td>
                          <td className={`py-2 px-2 text-right ${p.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{euro(p.profit)}</td>
                          <td className="py-2 px-2 text-right">{p.revenue > 0 ? `${p.marginPct.toFixed(1)}%` : '—'}</td>
                          <td className="py-2 px-2">
                            {p.ratingCount > 0 ? (
                              <span className="flex items-center gap-1.5">
                                <StarRating value={p.ratingAvg} size={13} />
                                <span className="text-xs text-muted-foreground">{p.ratingAvg.toFixed(1)} ({p.ratingCount})</span>
                              </span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
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
          {k && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard label="Bestandswert (EK)" value={euro(k.inventoryValueCt)} sub={`${k.inventoryUnits} Stück`} accent="text-rose-600" />
              <KpiCard label="Ladenhüter-Wert" value={euro(k.deadStockValueCt)} sub={`${k.deadStockCount} Produkte > 90 Tage`} accent="text-amber-600" />
              <KpiCard label="Nachbestellen" value={k.reorderCount} sub="unter Meldebestand" accent={k.reorderCount > 0 ? 'text-red-600' : ''} />
              <KpiCard label="Ware unterwegs" value={euro(k.openReceivablesCt)} sub={`${k.openUnits} Stück offen`} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader><CardTitle>Bestandswert je Kategorie</CardTitle></CardHeader>
              <CardContent>
                {!insights || insights.invByCategory.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Kein Bestand vorhanden</div>
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
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Kein Bestand vorhanden</div>
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
                <p className="text-sm text-muted-foreground">Produkte auf oder unter dem Meldebestand</p>
              </CardHeader>
              <CardContent>
                {!insights || insights.reorderList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Alles ausreichend bevorratet 👍</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
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
                <p className="text-sm text-muted-foreground">Bestand, aber seit über 90 Tagen nicht verkauft</p>
              </CardHeader>
              <CardContent>
                {!insights || insights.deadStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Ladenhüter 👍</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
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

        {/* ===================== LIEFERANTEN ===================== */}
        <TabsContent value="suppliers">
          {suppliers.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Noch keine Abrechnungsdaten je Lieferant</CardContent></Card>
          ) : (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Ø-Preis je Lieferant</CardTitle>
                  <p className="text-sm text-muted-foreground">Welcher Distributor zahlt die höheren Durchschnittspreise?</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(200, suppliers.length * 52)}>
                    <BarChart data={suppliers.map((s) => ({ name: s.name, 'Ø-Preis': s.avgPriceCt / 100 }))} layout="vertical" margin={{ left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                      <Bar dataKey="Ø-Preis" fill="#e11d48" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Lieferanten im Detail</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Lieferant</th>
                          <th className="text-right py-2 px-2">Umsatz</th>
                          <th className="text-right py-2 px-2">Gewinn</th>
                          <th className="text-right py-2 px-2">Marge</th>
                          <th className="text-right py-2 px-2">Ø-Preis</th>
                          <th className="text-right py-2 px-2">Stück</th>
                          <th className="text-right py-2 px-2">Produkte</th>
                          <th className="text-right py-2 px-2">Abrechn.</th>
                          <th className="text-right py-2 px-2">Lieferungen</th>
                          <th className="text-right py-2 px-2">Letzte Abr.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map((s) => (
                          <tr key={s.supplierId} className="border-b hover:bg-neutral-50">
                            <td className="py-2 px-2 font-medium">{s.name}</td>
                            <td className="py-2 px-2 text-right">{euro(s.revenue)}</td>
                            <td className={`py-2 px-2 text-right ${s.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{euro(s.profit)}</td>
                            <td className="py-2 px-2 text-right">{s.marginPct.toFixed(1)}%</td>
                            <td className="py-2 px-2 text-right font-medium text-rose-700">{euro(s.avgPriceCt)}</td>
                            <td className="py-2 px-2 text-right">{s.quantity}</td>
                            <td className="py-2 px-2 text-right">{s.productCount}</td>
                            <td className="py-2 px-2 text-right">{s.settlementCount}</td>
                            <td className="py-2 px-2 text-right">{s.deliveryCount}</td>
                            <td className="py-2 px-2 text-right">{formatDate(s.lastSettledAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {insights?.productBySupplier?.length ? (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Produkte je Lieferant</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Welche Produkte verkauft jeder Lieferant — Ø-Preis und Marge je Produkt
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">Lieferant</th>
                            <th className="text-left py-2 px-2">Produkt</th>
                            <th className="text-right py-2 px-2">Ø-Preis</th>
                            <th className="text-right py-2 px-2">Stück</th>
                            <th className="text-right py-2 px-2">Umsatz</th>
                            <th className="text-right py-2 px-2">Marge</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // For multi-supplier products, show best supplier highlighted
                            const bestByProduct = new Map<string, string>()
                            const grouped2 = new Map<string, typeof insights.productBySupplier>()
                            for (const e of insights.productBySupplier) {
                              const list = grouped2.get(e.productId) ?? []
                              list.push(e)
                              grouped2.set(e.productId, list)
                            }
                            for (const [pid, entries] of Array.from(grouped2.entries())) {
                              if (entries.length > 1) {
                                const best = [...entries].sort((a, b) => b.avgPriceCt - a.avgPriceCt)[0]
                                bestByProduct.set(`${pid}::${best.supplierId}`, 'best')
                              }
                            }
                            return insights.productBySupplier
                              .slice()
                              .sort((a, b) => a.supplierName.localeCompare(b.supplierName) || b.revenue - a.revenue)
                              .map((e) => {
                                const isBest = bestByProduct.has(`${e.productId}::${e.supplierId}`)
                                return (
                                  <tr key={`${e.productId}-${e.supplierId}`} className={`border-b hover:bg-neutral-50 ${isBest ? 'bg-green-50' : ''}`}>
                                    <td className="py-2 px-2 text-muted-foreground">{e.supplierName}</td>
                                    <td className="py-2 px-2 font-medium">
                                      <Link href={`/products/${e.productId}`} className="text-rose-600 hover:underline">
                                        {e.productName}
                                      </Link>
                                      {isBest && <span className="ml-1.5 text-xs text-green-600 font-normal">▲ bester Preis</span>}
                                    </td>
                                    <td className="py-2 px-2 text-right font-medium text-rose-700">{euro(e.avgPriceCt)}</td>
                                    <td className="py-2 px-2 text-right">{e.units}</td>
                                    <td className="py-2 px-2 text-right">{euro(e.revenue)}</td>
                                    <td className="py-2 px-2 text-right">{e.marginPct.toFixed(1)}%</td>
                                  </tr>
                                )
                              })
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </TabsContent>

        {/* ===================== BEWERTUNGEN ===================== */}
        <TabsContent value="reviews">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card><CardContent className="pt-4 flex flex-col items-center">
              <span className="text-4xl font-bold text-amber-500">{overallAvg.toFixed(1)}</span>
              <StarRating value={overallAvg} size={18} />
              <span className="text-xs text-muted-foreground mt-1">Ø über alle Produkte</span>
            </CardContent></Card>
            <KpiCard label="Bewertungen gesamt" value={totalReviews} />
            <KpiCard label="Bewertete Produkte" value={rated.length} sub={`von ${products.length}`} />
            <KpiCard label="Top-Produkt" value={bestRated?.name || '—'} sub={bestRated ? `${bestRated.ratingAvg.toFixed(1)} ★` : undefined} accent="text-base" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader><CardTitle>Sterne-Verteilung</CardTitle></CardHeader>
              <CardContent>
                {totalReviews === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Noch keine Bewertungen</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={distribution} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="star" tick={{ fontSize: 12 }} width={45} />
                      <Tooltip />
                      <Bar dataKey="Anzahl" radius={[0, 2, 2, 0]}>
                        {distribution.map((_, i) => (
                          <Cell key={i} fill={['#16a34a', '#84cc16', '#f59e0b', '#f97316', '#dc2626'][i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Beste & schlechteste Produkte</CardTitle></CardHeader>
              <CardContent>
                {rated.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine bewerteten Produkte</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> Top bewertet</p>
                      <div className="space-y-1.5">
                        {bestRatedList.map((p) => (
                          <Link key={p.id} href={`/products/${p.id}`} className="flex items-center justify-between text-sm hover:bg-neutral-50 rounded px-1 py-0.5">
                            <span className="font-medium truncate">{p.name}</span>
                            <span className="flex items-center gap-1.5 flex-shrink-0">
                              <StarRating value={p.ratingAvg} size={13} />
                              <span className="text-xs text-muted-foreground">{p.ratingAvg.toFixed(1)} ({p.ratingCount})</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-2">Schlechtest bewertet</p>
                      <div className="space-y-1.5">
                        {worstRatedList.map((p) => (
                          <Link key={p.id} href={`/products/${p.id}`} className="flex items-center justify-between text-sm hover:bg-neutral-50 rounded px-1 py-0.5">
                            <span className="font-medium truncate">{p.name}</span>
                            <span className="flex items-center gap-1.5 flex-shrink-0">
                              <StarRating value={p.ratingAvg} size={13} />
                              <span className="text-xs text-muted-foreground">{p.ratingAvg.toFixed(1)} ({p.ratingCount})</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Neueste Bewertungen</CardTitle>
                {reviews.length > 0 && <ExportButton href="/api/export/reviews" />}
              </div>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Bewertungen vorhanden</p>
              ) : (
                <div className="space-y-3">
                  {reviews.slice(0, 15).map((r) => (
                    <div key={r.id} className="flex items-start justify-between gap-4 pb-3 border-b last:border-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <StarRating value={r.rating} size={13} />
                          <Link href={`/products/${r.product.id}`} className="text-sm font-medium text-rose-600 hover:underline">{r.product.name}</Link>
                          <span className="text-xs text-muted-foreground">· {r.customerName || 'Anonym'} · {formatDate(r.createdAt)}</span>
                        </div>
                        {r.comment && <p className="text-sm text-muted-foreground break-words">{r.comment}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
