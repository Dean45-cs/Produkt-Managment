'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'

export default function ReceivePurchaseOrderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => fetch(`/api/purchase-orders/${id}`).then((r) => r.json()),
  })
  const { data: locations = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['locations'],
    queryFn: () => fetch('/api/locations').then((r) => r.json()),
  })

  const [locationId, setLocationId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/purchase-orders/${id}/receive`, jsonInit({
        locationId,
        items: order.items.map((item: { id: string; quantityOrdered: number }) => ({
          purchaseOrderItemId: item.id,
          quantityReceived: quantities[item.id] || item.quantityOrdered,
        })),
      })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-order', id] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      router.push(`/purchase-orders/${id}`)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>

  return (
    <div>
      <PageHeader title="Wareneingang buchen" description="Erhaltene Mengen eintragen und Bestand erhöhen" />

      <div className="max-w-xl space-y-6">
        <Card>
          <CardHeader><CardTitle>Ziel-Standort</CardTitle></CardHeader>
          <CardContent>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="Standort auswählen *" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Erhaltene Mengen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {order?.items.map((item: { id: string; product: { name: string }; quantityOrdered: number }) => (
              <div key={item.id} className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-sm text-muted-foreground">Bestellt: {item.quantityOrdered}</p>
                </div>
                <div className="w-28 space-y-1.5">
                  <Label>Erhalten</Label>
                  <Input
                    type="number"
                    min="0"
                    max={item.quantityOrdered}
                    value={quantities[item.id] ?? item.quantityOrdered}
                    onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: Number(e.target.value) }))}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button
          onClick={() => mutation.mutate()}
          disabled={!locationId || mutation.isPending}
        >
          {mutation.isPending ? 'Buchen...' : 'Wareneingang buchen'}
        </Button>
      </div>
    </div>
  )
}
