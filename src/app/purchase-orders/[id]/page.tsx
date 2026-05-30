'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { centsToEuro } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { PackageCheck } from 'lucide-react'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Entwurf',
  ORDERED: 'Bestellt',
  PARTIALLY_RECEIVED: 'Teilweise erhalten',
  RECEIVED: 'Erhalten',
  CANCELLED: 'Storniert',
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => fetch(`/api/purchase-orders/${id}`).then((r) => r.json()),
  })

  const markOrderedMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/purchase-orders/${id}`, jsonInit({ status: 'ORDERED', orderedAt: new Date().toISOString() }, 'PUT')),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-order', id] })
      toast('Als bestellt markiert', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>
  if (!order || order.error) return <div className="p-4">Bestellung nicht gefunden</div>

  const totalValue = order.items.reduce((s: number, i: { quantityOrdered: number; unitPriceCt: number }) => s + i.quantityOrdered * i.unitPriceCt, 0)

  return (
    <div>
      <PageHeader
        title={`Einkaufsbestellung`}
        description={order.supplier?.name ? `Lieferant: ${order.supplier.name}` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{STATUS_LABELS[order.status]}</Badge>
            {order.status === 'DRAFT' && (
              <Button variant="outline" onClick={() => markOrderedMutation.mutate()}>Als bestellt markieren</Button>
            )}
            {(order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED') && (
              <Link href={`/purchase-orders/${id}/receive`}>
                <Button><PackageCheck className="h-4 w-4" /> Wareneingang buchen</Button>
              </Link>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>Bestellpositionen · Gesamtwert: {centsToEuro(totalValue)}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produkt</TableHead>
                <TableHead>Bestellt</TableHead>
                <TableHead>Erhalten</TableHead>
                <TableHead>EK-Preis</TableHead>
                <TableHead>Gesamt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item: { id: string; product: { name: string }; quantityOrdered: number; quantityReceived: number; unitPriceCt: number }) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.product.name}</TableCell>
                  <TableCell>{item.quantityOrdered}</TableCell>
                  <TableCell>
                    <span className={item.quantityReceived >= item.quantityOrdered ? 'text-green-600' : 'text-yellow-600'}>
                      {item.quantityReceived}
                    </span>
                  </TableCell>
                  <TableCell>{centsToEuro(item.unitPriceCt)}</TableCell>
                  <TableCell>{centsToEuro(item.quantityOrdered * item.unitPriceCt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
