'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const { data: deliveries = [], isLoading } = useQuery<Delivery[]>({
    queryKey: ['deliveries'],
    queryFn: () => fetch('/api/deliveries').then((r) => r.json()),
  })

  return (
    <div>
      <PageHeader
        title="Ladungen an Verkäufer"
        description="Ware, die du deinen Verkäufern übergeben hast — inkl. Verkaufsfortschritt"
        actions={
          <Link href="/deliveries/new">
            <Button><Plus className="h-4 w-4" /> Neue Ladung</Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Erstellt</TableHead>
                <TableHead>Verkäufer</TableHead>
                <TableHead>Produkte</TableHead>
                <TableHead>Übergeben am</TableHead>
                <TableHead className="text-right">Abgerechnet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : deliveries.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Noch keine Ladungen</TableCell></TableRow>
              ) : deliveries.map((d) => {
                const settledSum = (d.settlements || []).reduce((s, x) => s + x.totalAmountCt, 0)
                return (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/deliveries/${d.id}`)}>
                  <TableCell className="text-sm">{formatDate(d.createdAt)}</TableCell>
                  <TableCell className="font-medium">{d.supplier.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span>{d.items.length} Pos. / {d.items.reduce((s, i) => s + i.quantitySent, 0)} Stück</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(d.deliveryDate)}</TableCell>
                  <TableCell className="text-right text-sm">{settledSum > 0 ? <span className="text-green-600 font-medium">{centsToEuro(settledSum)}</span> : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={DELIVERY_STATUS_VARIANTS[d.status]}>{DELIVERY_STATUS_LABELS[d.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Eye className="h-4 w-4 text-muted-foreground" />
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
