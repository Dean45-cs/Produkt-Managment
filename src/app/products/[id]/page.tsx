'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { centsToEuro } from '@/lib/money'
import { calcProfit } from '@/lib/calculations'
import { formatDate } from '@/lib/utils'
import { Pencil } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetch(`/api/products/${id}`).then((r) => r.json()),
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>
  if (!product) return <div className="p-4">Produkt nicht gefunden</div>

  const totalStock = product.inventory?.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0) || 0

  const totalRevenue = product.settlementItems?.reduce((s: number, i: { totalAmountCt: number }) => s + i.totalAmountCt, 0) || 0
  const totalQtySold = product.settlementItems?.reduce((s: number, i: { quantitySold: number }) => s + i.quantitySold, 0) || 0
  const avgPrice = totalQtySold > 0 ? Math.round(totalRevenue / totalQtySold) : 0
  const { profit, marginPct } = calcProfit(totalRevenue, totalQtySold, product.purchasePriceCt)

  // Zeitreihe je Abrechnung (chronologisch aufsteigend) für Ø-Preis- und Gewinnverlauf
  const trend = [...(product.settlementItems || [])]
    .map((si: { settlement: { settledAt: string }; quantitySold: number; totalAmountCt: number }) => ({
      date: si.settlement.settledAt,
      'Ø-Preis': si.quantitySold > 0 ? si.totalAmountCt / si.quantitySold / 100 : 0,
      Gewinn: (si.totalAmountCt - si.quantitySold * product.purchasePriceCt) / 100,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((d) => ({ ...d, label: formatDate(d.date) }))

  return (
    <div>
      <PageHeader
        title={product.name}
        description={`SKU: ${product.sku}`}
        actions={
          <Link href={`/products/${id}/edit`}>
            <Button variant="outline"><Pencil className="h-4 w-4" /> Bearbeiten</Button>
          </Link>
        }
      />

      {product.imageUrl && (
        <div className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.imageUrl} alt={product.name} className="h-40 w-40 rounded-lg object-cover border" />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Kategorie</p>
          <p className="font-medium">{product.category?.name || '—'}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">EK-Preis</p>
          <p className="font-medium">{centsToEuro(product.purchasePriceCt)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Ø VK-Preis</p>
          <p className="font-medium">{centsToEuro(avgPrice)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Gesamtgewinn</p>
          <p className={`font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {centsToEuro(profit)} ({marginPct.toFixed(1)}%)
          </p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Bestand je Standort</CardTitle></CardHeader>
          <CardContent>
            {product.inventory?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kein Bestand erfasst</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Standort</TableHead>
                    <TableHead>Menge</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.inventory?.map((inv: { id: string; location: { name: string }; quantity: number }) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.location.name}</TableCell>
                      <TableCell>{inv.quantity} {product.unit}</TableCell>
                      <TableCell>
                        {inv.quantity === 0 ? <Badge variant="destructive">Leer</Badge> :
                         inv.quantity <= product.reorderPoint ? <Badge variant="warning">Niedrig</Badge> :
                         <Badge variant="success">OK</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-bold">Gesamt</TableCell>
                    <TableCell className="font-bold">{totalStock} {product.unit}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Letzte Abrechnungen</CardTitle></CardHeader>
          <CardContent>
            {product.settlementItems?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Abrechnungen</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Menge</TableHead>
                    <TableHead>Betrag</TableHead>
                    <TableHead>Ø-Preis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.settlementItems?.map((si: { id: string; settlement: { settledAt: string }; quantitySold: number; totalAmountCt: number }) => (
                    <TableRow key={si.id}>
                      <TableCell>{formatDate(si.settlement.settledAt)}</TableCell>
                      <TableCell>{si.quantitySold}</TableCell>
                      <TableCell>{centsToEuro(si.totalAmountCt)}</TableCell>
                      <TableCell>{centsToEuro(Math.round(si.totalAmountCt / si.quantitySold))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Ø-Preis- & Gewinnverlauf</CardTitle></CardHeader>
        <CardContent>
          {trend.length < 2 ? (
            <p className="text-sm text-muted-foreground">Mindestens 2 Abrechnungen nötig für einen Verlauf</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                <Legend />
                <Line type="monotone" dataKey="Ø-Preis" stroke="#8b5cf6" strokeWidth={2} dot />
                <Line type="monotone" dataKey="Gewinn" stroke="#34d399" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
