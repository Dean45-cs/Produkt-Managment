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
import { PackageCheck, Truck } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ausstehend',
  DELIVERED: 'Geliefert',
  SETTLED: 'Abgerechnet',
  CANCELLED: 'Storniert',
}

const STATUS_VARIANTS: Record<string, 'default' | 'warning' | 'success' | 'destructive' | 'secondary'> = {
  PENDING: 'secondary',
  DELIVERED: 'warning',
  SETTLED: 'success',
  CANCELLED: 'destructive',
}

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: delivery, isLoading } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => fetch(`/api/deliveries/${id}`).then((r) => r.json()),
  })

  const markDeliveredMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/deliveries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery', id] }),
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>
  if (!delivery || delivery.error) return <div className="p-4">Lieferung nicht gefunden</div>

  const totalQty = delivery.items.reduce((s: number, i: { quantitySent: number }) => s + i.quantitySent, 0)

  return (
    <div>
      <PageHeader
        title={`Lieferung an ${delivery.supplier.name}`}
        description={`Erstellt am ${formatDate(delivery.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANTS[delivery.status]}>{STATUS_LABELS[delivery.status]}</Badge>
            {delivery.status === 'PENDING' && (
              <Button onClick={() => markDeliveredMutation.mutate()} disabled={markDeliveredMutation.isPending}>
                <Truck className="h-4 w-4" /> Als geliefert markieren
              </Button>
            )}
            {delivery.status === 'DELIVERED' && !delivery.settlement && (
              <Link href={`/deliveries/${id}/settle`}>
                <Button>
                  <PackageCheck className="h-4 w-4" /> Abrechnen
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Lieferungspositionen</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Standort</TableHead>
                  <TableHead>Menge</TableHead>
                  <TableHead>Erw. Preis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delivery.items.map((item: { id: string; product: { name: string; sku: string }; location: { name: string }; quantitySent: number; expectedPriceCt?: number }) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                    </TableCell>
                    <TableCell>{item.location.name}</TableCell>
                    <TableCell>{item.quantitySent}</TableCell>
                    <TableCell>{item.expectedPriceCt ? centsToEuro(item.expectedPriceCt) : '—'}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">Gesamt</TableCell>
                  <TableCell className="font-bold">{totalQty}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lieferant</span>
                <span className="font-medium">{delivery.supplier.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={STATUS_VARIANTS[delivery.status]}>{STATUS_LABELS[delivery.status]}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Geliefert am</span>
                <span>{formatDate(delivery.deliveryDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notizen</span>
                <span>{delivery.notes || '—'}</span>
              </div>
            </CardContent>
          </Card>

          {delivery.settlement && (
            <Card>
              <CardHeader><CardTitle>Abrechnung</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Abgerechnet am</span>
                  <span>{formatDate(delivery.settlement.settledAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gesamtbetrag</span>
                  <span className="font-bold text-green-600">{centsToEuro(delivery.settlement.totalAmountCt)}</span>
                </div>
                {delivery.settlement.items?.map((si: { id: string; product: { name: string }; quantitySold: number; totalAmountCt: number }) => (
                  <div key={si.id} className="flex justify-between">
                    <span>{si.product.name} ({si.quantitySold} Stück)</span>
                    <span>{centsToEuro(si.totalAmountCt)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
