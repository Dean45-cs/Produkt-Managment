'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { centsToEuro } from '@/lib/money'
import { calcProfit } from '@/lib/calculations'
import { formatDate } from '@/lib/utils'
import { ExportButton } from '@/components/ExportButton'
import { Eye } from 'lucide-react'

interface Settlement {
  id: string
  settledAt: string
  totalAmountCt: number
  delivery: { supplier: { name: string } }
  items: Array<{ quantitySold: number; totalAmountCt: number; product: { purchasePriceCt: number; name: string } }>
}

export default function SettlementsPage() {
  const { data: settlements = [], isLoading } = useQuery<Settlement[]>({
    queryKey: ['settlements'],
    queryFn: () => fetch('/api/settlements').then((r) => r.json()),
  })

  return (
    <div>
      <PageHeader
        title="Abrechnungen"
        description="Alle Abrechnungen von Distributoren"
        actions={<ExportButton href="/api/export/settlements" />}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Lieferant</TableHead>
                <TableHead>Positionen</TableHead>
                <TableHead>Umsatz</TableHead>
                <TableHead>Kosten</TableHead>
                <TableHead>Gewinn</TableHead>
                <TableHead>Marge</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : settlements.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Noch keine Abrechnungen</TableCell></TableRow>
              ) : settlements.map((s) => {
                const totalQty = s.items.reduce((sum, i) => sum + i.quantitySold, 0)
                const totalCost = s.items.reduce((sum, i) => sum + i.quantitySold * i.product.purchasePriceCt, 0)
                const { profit, marginPct } = calcProfit(s.totalAmountCt, totalQty, totalCost / Math.max(totalQty, 1))

                return (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.settledAt)}</TableCell>
                    <TableCell className="font-medium">{s.delivery.supplier.name}</TableCell>
                    <TableCell>{s.items.length} Pos. / {totalQty} Stück</TableCell>
                    <TableCell className="font-medium text-rose-600">{centsToEuro(s.totalAmountCt)}</TableCell>
                    <TableCell>{centsToEuro(totalCost)}</TableCell>
                    <TableCell className={profit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {centsToEuro(profit)}
                    </TableCell>
                    <TableCell>{marginPct.toFixed(1)}%</TableCell>
                    <TableCell>
                      <Link href={`/settlements/${s.id}`}>
                        <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                      </Link>
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
