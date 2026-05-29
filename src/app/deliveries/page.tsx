'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { centsToEuro } from '@/lib/money'
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_VARIANTS } from '@/lib/delivery'
import { Plus, Eye } from 'lucide-react'

interface Delivery {
  id: string
  status: string
  deliveryDate?: string
  createdAt: string
  supplier: { name: string }
  items: Array<{ quantitySent: number; product: { name: string } }>
  settlements?: Array<{ totalAmountCt: number }>
}

export default function DeliveriesPage() {
  const { data: deliveries = [], isLoading } = useQuery<Delivery[]>({
    queryKey: ['deliveries'],
    queryFn: () => fetch('/api/deliveries').then((r) => r.json()),
  })

  return (
    <div>
      <PageHeader
        title="Lieferungen"
        description="Lieferungen an Distributoren"
        actions={
          <Link href="/deliveries/new">
            <Button><Plus className="h-4 w-4" /> Neue Lieferung</Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Erstellt</TableHead>
                <TableHead>Lieferant</TableHead>
                <TableHead>Produkte</TableHead>
                <TableHead>Geliefert am</TableHead>
                <TableHead className="text-right">Abgerechnet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : deliveries.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Noch keine Lieferungen</TableCell></TableRow>
              ) : deliveries.map((d) => {
                const settledSum = (d.settlements || []).reduce((s, x) => s + x.totalAmountCt, 0)
                return (
                <TableRow key={d.id}>
                  <TableCell className="text-sm">{formatDate(d.createdAt)}</TableCell>
                  <TableCell className="font-medium">{d.supplier.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span>{d.items.length} Pos. / {d.items.reduce((s, i) => s + i.quantitySent, 0)} Stück</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(d.deliveryDate)}</TableCell>
                  <TableCell className="text-right text-sm">{settledSum > 0 ? centsToEuro(settledSum) : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={DELIVERY_STATUS_VARIANTS[d.status]}>{DELIVERY_STATUS_LABELS[d.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/deliveries/${d.id}`}>
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
