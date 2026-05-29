'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { centsToEuro } from '@/lib/money'
import { calcProfit } from '@/lib/calculations'
import { formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

export default function SettlementDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: settlement, isLoading } = useQuery({
    queryKey: ['settlement', id],
    queryFn: () => fetch(`/api/settlements/${id}`).then((r) => r.json()),
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>
  if (!settlement || settlement.error) return <div className="p-4">Abrechnung nicht gefunden</div>

  const totalQtySold = settlement.items.reduce((s: number, i: { quantitySold: number }) => s + i.quantitySold, 0)
  const totalCost = settlement.items.reduce((s: number, i: { quantitySold: number; product: { purchasePriceCt: number } }) => s + i.quantitySold * i.product.purchasePriceCt, 0)
  const { profit, marginPct } = calcProfit(settlement.totalAmountCt, totalQtySold, totalCost / Math.max(totalQtySold, 1))

  return (
    <div>
      <PageHeader
        title="Abrechnungsdetail"
        description={`${settlement.delivery.supplier.name} · ${formatDate(settlement.settledAt)}`}
        actions={
          <Link href="/settlements">
            <Button variant="outline"><ArrowLeft className="h-4 w-4" /> Zurück</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Umsatz</p>
          <p className="text-xl font-bold text-rose-600">{centsToEuro(settlement.totalAmountCt)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Kosten (EK)</p>
          <p className="text-xl font-bold">{centsToEuro(totalCost)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Gewinn</p>
          <p className={`text-xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{centsToEuro(profit)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Marge</p>
          <p className={`text-xl font-bold ${marginPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{marginPct.toFixed(1)}%</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Positionen</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produkt</TableHead>
                <TableHead>Verkauft</TableHead>
                <TableHead>Betrag</TableHead>
                <TableHead>Ø VK-Preis</TableHead>
                <TableHead>EK-Preis</TableHead>
                <TableHead>Gewinn/Stück</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlement.items.map((item: { id: string; product: { name: string; purchasePriceCt: number }; quantitySold: number; totalAmountCt: number }) => {
                const avgPriceCt = item.quantitySold > 0 ? Math.round(item.totalAmountCt / item.quantitySold) : 0
                const profitPerUnit = avgPriceCt - item.product.purchasePriceCt
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product.name}</TableCell>
                    <TableCell>{item.quantitySold}</TableCell>
                    <TableCell>{centsToEuro(item.totalAmountCt)}</TableCell>
                    <TableCell className="font-medium">{centsToEuro(avgPriceCt)}</TableCell>
                    <TableCell>{centsToEuro(item.product.purchasePriceCt)}</TableCell>
                    <TableCell className={profitPerUnit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {centsToEuro(profitPerUnit)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
