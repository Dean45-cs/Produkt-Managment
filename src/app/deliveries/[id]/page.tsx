'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { centsToEuro } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { deliveryProgress, DELIVERY_STATUS_LABELS, DELIVERY_STATUS_VARIANTS } from '@/lib/delivery'
import { PackageCheck, Truck, Eye, ArrowLeft } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/toast'

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: delivery, isLoading } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => fetch(`/api/deliveries/${id}`).then((r) => r.json()),
  })

  const markDeliveredMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/deliveries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery', id] })
      toast('Ladung an Verkäufer übergeben – Bestand reduziert', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>
  if (!delivery || delivery.error) return <div className="p-4">Ladung nicht gefunden</div>

  const progress = deliveryProgress(delivery)
  const settlements: Array<{ id: string; settledAt: string; totalAmountCt: number; notes?: string; items: Array<{ quantitySold: number }> }> = delivery.settlements || []
  const canSettle = (delivery.status === 'DELIVERED' || delivery.status === 'PARTIALLY_SETTLED') && progress.totalOpen > 0

  return (
    <div>
      <PageHeader
        title={`Ladung an ${delivery.supplier.name}`}
        description={`Erstellt am ${formatDate(delivery.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/deliveries">
              <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Zurück</Button>
            </Link>
            <Badge variant={DELIVERY_STATUS_VARIANTS[delivery.status]}>{DELIVERY_STATUS_LABELS[delivery.status]}</Badge>
            {delivery.status === 'PENDING' && (
              <Button onClick={() => markDeliveredMutation.mutate()} disabled={markDeliveredMutation.isPending}>
                <Truck className="h-4 w-4" /> An Verkäufer übergeben
              </Button>
            )}
            {canSettle && (
              <Link href={`/deliveries/${id}/settle`}>
                <Button>
                  <PackageCheck className="h-4 w-4" /> {settlements.length > 0 ? 'Weiteren Verkauf erfassen' : 'Verkauf erfassen'}
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Nächster Schritt-Hinweis */}
      {delivery.status === 'PENDING' && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
          <Truck className="h-4 w-4 mt-0.5 flex-shrink-0 text-sky-400" />
          <div>
            <p className="font-semibold">Nächster Schritt: Übergabe bestätigen</p>
            <p className="text-sky-300/80 mt-0.5">Sobald dein Verkäufer die Ware abgeholt hat, klicke auf <strong>„An Verkäufer übergeben"</strong>. Dadurch wird der Bestand sofort reduziert und du kannst später Verkäufe erfassen.</p>
          </div>
        </div>
      )}

      {/* Fortschritt der Abrechnung */}
      {delivery.status !== 'PENDING' && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Verkaufsfortschritt</CardTitle>
              <span className="text-sm text-muted-foreground">
                {progress.totalSettled} / {progress.totalSent} Stück verkauft · {progress.totalOpen} offen
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden mb-4">
              <div
                className="h-full bg-rose-600 transition-all"
                style={{ width: `${progress.totalSent > 0 ? ((progress.totalSettled + progress.totalReturned) / progress.totalSent) * 100 : 0}%` }}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produkt</TableHead>
                  <TableHead className="text-right">Übergeben</TableHead>
                  <TableHead className="text-right">Verkauft</TableHead>
                  <TableHead className="text-right">Retour</TableHead>
                  <TableHead className="text-right">Offen</TableHead>
                  <TableHead className="text-right">Erlös</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progress.perProduct.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell className="font-medium">{p.productName}</TableCell>
                    <TableCell className="text-right">{p.quantitySent}</TableCell>
                    <TableCell className="text-right">{p.quantitySettled}</TableCell>
                    <TableCell className="text-right">{p.quantityReturned}</TableCell>
                    <TableCell className="text-right">
                      {p.quantityOpen > 0 ? <span className="font-medium text-rose-600">{p.quantityOpen}</span> : <Badge variant="success">0</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{centsToEuro(p.amountSettledCt)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-bold">Gesamt</TableCell>
                  <TableCell className="text-right font-bold">{progress.totalSent}</TableCell>
                  <TableCell className="text-right font-bold">{progress.totalSettled}</TableCell>
                  <TableCell className="text-right font-bold">{progress.totalReturned}</TableCell>
                  <TableCell className="text-right font-bold">{progress.totalOpen}</TableCell>
                  <TableCell className="text-right font-bold text-green-600">{centsToEuro(progress.amountSettledCt)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Ladungspositionen</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Standort</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead>Menge</TableHead>
                  <TableHead>Erw. Preis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delivery.items.map((item: { id: string; product: { name: string; sku: string }; location: { name: string }; quantitySent: number; expectedPriceCt?: number; batchNumber?: string }) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                    </TableCell>
                    <TableCell>{item.location.name}</TableCell>
                    <TableCell className="font-mono text-xs">{item.batchNumber || '—'}</TableCell>
                    <TableCell>{item.quantitySent}</TableCell>
                    <TableCell>{item.expectedPriceCt ? centsToEuro(item.expectedPriceCt) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Verkäufer</span>
                <span className="font-medium">{delivery.supplier.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={DELIVERY_STATUS_VARIANTS[delivery.status]}>{DELIVERY_STATUS_LABELS[delivery.status]}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Übergeben am</span>
                <span>{formatDate(delivery.deliveryDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notizen</span>
                <span>{delivery.notes || '—'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Verkäufe</CardTitle>
                {settlements.length > 0 && <Badge variant="secondary">{settlements.length}</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {settlements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch kein Verkauf erfasst.</p>
              ) : (
                <div className="space-y-2">
                  {settlements.map((s, i) => {
                    const qty = s.items.reduce((sum, it) => sum + it.quantitySold, 0)
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">Verkauf {i + 1} · {formatDate(s.settledAt)}</p>
                          <p className="text-xs text-muted-foreground">{qty} Stück verkauft</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-green-600">{centsToEuro(s.totalAmountCt)}</span>
                          <Link href={`/settlements/${s.id}`}>
                            <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
