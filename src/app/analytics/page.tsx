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
import { Trophy, Package } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'

interface RevenueData {
  history: Array<{ period: string; revenue: number; cost: number; profit: number; quantity: number }>
  forecast: Array<{ period: string; revenue: number; quantity: number }>
}

interface SupplierStat {
  supplierId: string
  name: string
  revenue: number
  cost: number
  profit: number
  quantity: number
  settlementCount: number
  deliveryCount: number
  productCount: number
  avgPriceCt: number
  marginPct: number
  lastSettledAt: string | null
}

interface ProductStat {
  id: string
  name: string
  sku: string
  imageUrl?: string | null
  category?: { name: string; color?: string | null } | null
  purchasePriceCt: number
  revenue: number
  cost: number
  profit: number
  quantity: number
  avgPriceCt: number
  marginPct: number
  stock: number
  settlementCount: number
  ratingAvg: number
  ratingCount: number
  lastSold: string | null
}

interface Review {
  id: string
  rating: number
  comment?: string | null
  customerName?: string | null
  createdAt: string
  product: { id: string; name: string; sku: string }
}

function KpiCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string }) {
  return (
    <Card><CardContent className="pt-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${accent || ''}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent></Card>
  )
}

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

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>

  // ---- Übersicht ----
  const historyChart = revData?.history.map((h) => ({
    period: h.period, Umsatz: h.revenue / 100, Kosten: h.cost / 100, Gewinn: h.profit / 100,
  })) || []
  const forecastChart = [
    ...(revData?.history.slice(-3).map((h) => ({ period: h.period, Historisch: h.revenue / 100 })) || []),
    ...(revData?.forecast.map((f) => ({ period: f.period, Forecast: f.revenue / 100 })) || []),
  ]
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
    star: `${star} ★`,
    Anzahl: reviews.filter((r) => r.rating === star).length,
  }))
  const bestRatedList = [...rated].sort((a, b) => b.ratingAvg - a.ratingAvg).slice(0, 5)
  const worstRatedList = [...rated].sort((a, b) => a.ratingAvg - b.ratingAvg).slice(0, 5)

  return (
    <div>
      <PageHeader
        title="Analyse & Forecast"
        description="Umsatz, Produkte, Lieferanten und Kundenzufriedenheit im Detail"
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="products">Produkte</TabsTrigger>
          <TabsTrigger value="suppliers">Lieferanten</TabsTrigger>
          <TabsTrigger value="reviews">Bewertungen</TabsTrigger>
        </TabsList>

        {/* ===================== ÜBERSICHT ===================== */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard label="Gesamtumsatz" value={centsToEuro(totalRevenue)} accent="text-rose-600" />
            <KpiCard label="Gesamtgewinn" value={centsToEuro(totalProfit)} accent={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'} />
            <KpiCard label="Ø Marge" value={`${avgMargin.toFixed(1)}%`} />
            <KpiCard label="Verkaufte Stück gesamt" value={totalQty} />
          </div>

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

          <Card>
            <CardHeader><CardTitle>Monatsdetails</CardTitle></CardHeader>
            <CardContent>
              {revData?.history.length === 0 ? (
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
                      </tr>
                    </thead>
                    <tbody>
                      {revData?.history.map((h) => {
                        const margin = h.revenue > 0 ? (h.profit / h.revenue) * 100 : 0
                        return (
                          <tr key={h.period} className="border-b hover:bg-neutral-50">
                            <td className="py-2 px-2 font-medium">{h.period}</td>
                            <td className="py-2 px-2 text-right">{centsToEuro(h.revenue)}</td>
                            <td className="py-2 px-2 text-right">{centsToEuro(h.cost)}</td>
                            <td className={`py-2 px-2 text-right font-medium ${h.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{centsToEuro(h.profit)}</td>
                            <td className="py-2 px-2 text-right">{margin.toFixed(1)}%</td>
                            <td className="py-2 px-2 text-right">{h.quantity}</td>
                          </tr>
                        )
                      })}
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
            <KpiCard label="💰 Umsatz-König" value={topRevenue?.name || '—'} sub={topRevenue ? centsToEuro(topRevenue.revenue) : undefined} accent="text-base" />
            <KpiCard label="📈 Gewinn-König" value={topProfit?.name || '—'} sub={topProfit ? centsToEuro(topProfit.profit) : undefined} accent="text-base" />
            <KpiCard label="⭐ Bestbewertet" value={bestRated?.name || '—'} sub={bestRated ? `${bestRated.ratingAvg.toFixed(1)} ★ (${bestRated.ratingCount})` : undefined} accent="text-base" />
          </div>

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
                          <td className="py-2 px-2 text-right">{p.avgPriceCt > 0 ? centsToEuro(p.avgPriceCt) : '—'}</td>
                          <td className="py-2 px-2 text-right font-medium">{centsToEuro(p.revenue)}</td>
                          <td className={`py-2 px-2 text-right ${p.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{centsToEuro(p.profit)}</td>
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
                            <td className="py-2 px-2 text-right">{centsToEuro(s.revenue)}</td>
                            <td className={`py-2 px-2 text-right ${s.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{centsToEuro(s.profit)}</td>
                            <td className="py-2 px-2 text-right">{s.marginPct.toFixed(1)}%</td>
                            <td className="py-2 px-2 text-right font-medium text-rose-700">{centsToEuro(s.avgPriceCt)}</td>
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
            <KpiCard
              label="Top-Produkt"
              value={bestRated?.name || '—'}
              sub={bestRated ? `${bestRated.ratingAvg.toFixed(1)} ★` : undefined}
              accent="text-base"
            />
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
