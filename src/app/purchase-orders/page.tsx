'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { Plus, Eye } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Entwurf',
  ORDERED: 'Bestellt',
  PARTIALLY_RECEIVED: 'Teilweise erhalten',
  RECEIVED: 'Erhalten',
  CANCELLED: 'Storniert',
}

const STATUS_VARIANTS: Record<string, 'default' | 'warning' | 'success' | 'destructive' | 'secondary'> = {
  DRAFT: 'secondary',
  ORDERED: 'default',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'destructive',
}

interface PurchaseOrder {
  id: string
  status: string
  orderedAt?: string
  receivedAt?: string
  createdAt: string
  supplier?: { name: string }
  items: Array<{ quantityOrdered: number; quantityReceived: number; product: { name: string } }>
}

export default function PurchaseOrdersPage() {
  const { data: orders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders'],
    queryFn: () => fetch('/api/purchase-orders').then((r) => r.json()),
  })

  return (
    <div>
      <PageHeader
        title="Einkaufsbestellungen"
        description="Bestellungen zum Auffüllen des Bestands"
        actions={
          <Link href="/purchase-orders/new">
            <Button><Plus className="h-4 w-4" /> Neue Bestellung</Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Erstellt</TableHead>
                <TableHead>Großhändler</TableHead>
                <TableHead>Positionen</TableHead>
                <TableHead>Bestellt am</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Noch keine Bestellungen</TableCell></TableRow>
              ) : orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{formatDate(o.createdAt)}</TableCell>
                  <TableCell>{o.supplier?.name || '—'}</TableCell>
                  <TableCell>{o.items.length} Pos. / {o.items.reduce((s, i) => s + i.quantityOrdered, 0)} Stück</TableCell>
                  <TableCell>{formatDate(o.orderedAt)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[o.status]}>{STATUS_LABELS[o.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/purchase-orders/${o.id}`}>
                      <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
