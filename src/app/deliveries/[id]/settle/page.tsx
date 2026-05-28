'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { centsToEuro, euroToCents, centsToDecimal } from '@/lib/money'

interface SettlementItemInput {
  productId: string
  productName: string
  quantitySent: number
  quantitySold: number
  totalAmount: number
}

export default function SettlePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: delivery, isLoading } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => fetch(`/api/deliveries/${id}`).then((r) => r.json()),
  })

  const [settledAt, setSettledAt] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<SettlementItemInput[]>([])

  // Initialize items from delivery when loaded
  const initialized = items.length > 0 || !delivery

  if (!initialized && delivery?.items) {
    setItems(delivery.items.map((item: { productId: string; product: { name: string }; quantitySent: number }) => ({
      productId: item.productId,
      productName: item.product.name,
      quantitySent: item.quantitySent,
      quantitySold: item.quantitySent,
      totalAmount: 0,
    })))
  }

  const mutation = useMutation({
    mutationFn: (data: { settledAt: string; totalAmountCt: number; notes: string; items: Array<{ productId: string; quantitySold: number; totalAmountCt: number }> }) =>
      fetch(`/api/deliveries/${id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery', id] })
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      router.push(`/deliveries/${id}`)
    },
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>
  if (!delivery || delivery.error) return <div className="p-4">Lieferung nicht gefunden</div>

  const totalAmountCt = items.reduce((sum, i) => sum + euroToCents(i.totalAmount), 0)

  function updateItem(idx: number, field: keyof SettlementItemInput, value: number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({
      settledAt,
      totalAmountCt,
      notes,
      items: items.map((i) => ({
        productId: i.productId,
        quantitySold: i.quantitySold,
        totalAmountCt: euroToCents(i.totalAmount),
      })),
    })
  }

  return (
    <div>
      <PageHeader
        title="Lieferung abrechnen"
        description={`Lieferung an ${delivery.supplier?.name}`}
      />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle>Abrechnungsdaten</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Abrechnungsdatum</Label>
              <Input type="date" value={settledAt} onChange={(e) => setSettledAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notizen</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Verkaufte Mengen & Beträge</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tragt ein, wie viele Stück euer Lieferant von jedem Produkt verkauft hat und den dafür erhaltenen Gesamtbetrag.
              Der Durchschnittspreis wird automatisch berechnet.
            </p>
            {items.map((item, idx) => {
              const avgPriceCt = item.quantitySold > 0 ? euroToCents(item.totalAmount) / item.quantitySold : 0
              return (
                <div key={idx} className="p-4 rounded-lg border bg-gray-50">
                  <p className="font-medium mb-3">{item.productName}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Geliefert</Label>
                      <Input value={item.quantitySent} disabled className="bg-gray-100" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Verkauft *</Label>
                      <Input
                        type="number"
                        min="0"
                        max={item.quantitySent}
                        value={item.quantitySold}
                        onChange={(e) => updateItem(idx, 'quantitySold', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Gesamtbetrag (€) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.totalAmount}
                        onChange={(e) => updateItem(idx, 'totalAmount', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  {item.quantitySold > 0 && item.totalAmount > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Ø-Preis: <strong>{centsToEuro(Math.round(avgPriceCt))}</strong> pro Stück
                    </p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Gesamtbetrag</span>
              <span className="text-2xl font-bold text-green-600">{centsToEuro(totalAmountCt)}</span>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={mutation.isPending || totalAmountCt === 0}>
          {mutation.isPending ? 'Speichern...' : 'Abrechnung abschließen'}
        </Button>
      </form>
    </div>
  )
}
