'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { Plus, Eye, ShoppingCart } from 'lucide-react'

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
  const router = useRouter()
  const { data: orders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders'],
    queryFn: () => fetch('/api/purchase-orders').then((r) => r.json()),
  })

  return (
    <div>
      <PageHeader
        title="Einkauf beim Großhändler"
        description="Ware einkaufen → beim Wareneingang ('Erhalten') steigt dein Lagerbestand"
        actions={
          <Link href="/purchase-orders/new">
            <Button><Plus className="h-4 w-4" /> Neue Bestellung</Button>
          </Link>
        }
      />

      {!isLoading && orders.length === 0 ? (
        <Card><CardContent className="p-0">
          <EmptyState
            icon={ShoppingCart}
            title="Noch keine Bestellungen"
            description="Bestelle Ware bei deinem Großhändler. Beim Wareneingang („Erhalten“) wird dein Lagerbestand automatisch erhöht."
            actionHref="/purchase-orders/new"
            actionLabel="Erste Bestellung anlegen"
          />
        </CardContent></Card>
      ) : (
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
              ) : orders.map((o) => (
                <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/purchase-orders/${o.id}`)}>
                  <TableCell>{formatDate(o.createdAt)}</TableCell>
                  <TableCell>{o.supplier?.name || '—'}</TableCell>
                  <TableCell>{o.items.length} Pos. / {o.items.reduce((s, i) => s + i.quantityOrdered, 0)} Stück</TableCell>
                  <TableCell>{formatDate(o.orderedAt)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[o.status]}>{STATUS_LABELS[o.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
