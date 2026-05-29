'use client'

import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { centsToEuro } from '@/lib/money'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
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
  avgPriceCt: number
  marginPct: number
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<RevenueData>({
    queryKey: ['analytics-revenue'],
    queryFn: () => fetch('/api/analytics/revenue').then((r) => r.json()),
  })

  const { data: suppliers = [] } = useQuery<SupplierStat[]>({
    queryKey: ['analytics-suppliers'],
    queryFn: () => fetch('/api/analytics/suppliers').then((r) => r.json()),
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>

  const historyChart = data?.history.map((h) => ({
    period: h.period,
    Umsatz: h.revenue / 100,
    Kosten: h.cost / 100,
    Gewinn: h.profit / 100,
  })) || []

  const forecastChart = [
    ...(data?.history.slice(-3).map((h) => ({ period: h.period, Historisch: h.revenue / 100 })) || []),
    ...(data?.forecast.map((f) => ({ period: f.period, Forecast: f.revenue / 100 })) || []),
  ]

  const supplierChart = suppliers.map((s) => ({
    name: s.name,
    'Ø-Preis': s.avgPriceCt / 100,
    Umsatz: s.revenue / 100,
  }))

  const totalRevenue = data?.history.reduce((s, h) => s + h.revenue, 0) || 0
  const totalProfit = data?.history.reduce((s, h) => s + h.profit, 0) || 0
  const totalQty = data?.history.reduce((s, h) => s + h.quantity, 0) || 0
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  return (
    <div>
      <PageHeader title="Analyse & Forecast" description="Umsatz, Gewinn und Prognose" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Gesamtumsatz</p>
          <p className="text-xl font-bold text-rose-600">{centsToEuro(totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Gesamtgewinn</p>
          <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{centsToEuro(totalProfit)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Ø Marge</p>
          <p className="text-xl font-bold">{avgMargin.toFixed(1)}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Verkaufte Stück gesamt</p>
          <p className="text-xl font-bold">{totalQty}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>Umsatz & Gewinn je Monat</CardTitle></CardHeader>
          <CardContent>
            {historyChart.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Noch keine Abrechnungsdaten vorhanden
              </div>
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
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Zu wenig Daten für Forecast (mind. 2 Monate)
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={forecastChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                  <Legend />
                  <Line type="monotone" dataKey="Historisch" stroke="#e11d48" strokeWidth={2} dot={true} />
                  <Line type="monotone" dataKey="Forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={true} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Monatsdetails</CardTitle></CardHeader>
        <CardContent>
          {data?.history.length === 0 ? (
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
                  {data?.history.map((h) => {
                    const margin = h.revenue > 0 ? (h.profit / h.revenue) * 100 : 0
                    return (
                      <tr key={h.period} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{h.period}</td>
                        <td className="py-2 px-2 text-right">{centsToEuro(h.revenue)}</td>
                        <td className="py-2 px-2 text-right">{centsToEuro(h.cost)}</td>
                        <td className={`py-2 px-2 text-right font-medium ${h.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {centsToEuro(h.profit)}
                        </td>
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Lieferanten-Vergleich</CardTitle>
          <p className="text-sm text-muted-foreground">Welcher Distributor zahlt die höheren Durchschnittspreise?</p>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Abrechnungsdaten je Lieferant</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={Math.max(180, suppliers.length * 48)}>
                <BarChart data={supplierChart} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                  <Legend />
                  <Bar dataKey="Ø-Preis" fill="#e11d48" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Lieferant</th>
                      <th className="text-right py-2 px-2">Umsatz</th>
                      <th className="text-right py-2 px-2">Ø-Preis</th>
                      <th className="text-right py-2 px-2">Gewinn</th>
                      <th className="text-right py-2 px-2">Marge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <tr key={s.supplierId} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{s.name}</td>
                        <td className="py-2 px-2 text-right">{centsToEuro(s.revenue)}</td>
                        <td className="py-2 px-2 text-right font-medium text-rose-700">{centsToEuro(s.avgPriceCt)}</td>
                        <td className={`py-2 px-2 text-right ${s.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {centsToEuro(s.profit)}
                        </td>
                        <td className="py-2 px-2 text-right">{s.marginPct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
