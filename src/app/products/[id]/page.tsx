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
    </div>
  )
}
