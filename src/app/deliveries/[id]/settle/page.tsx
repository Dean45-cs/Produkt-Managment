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
import { Badge } from '@/components/ui/badge'
import { centsToEuro, euroToCents } from '@/lib/money'
import { deliveryProgress } from '@/lib/delivery'
import { toast } from '@/lib/toast'

interface SettlementItemInput {
  productId: string
  productName: string
  quantitySent: number
  quantitySettled: number
  quantityReturned: number
  quantityOpen: number
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
  const [error, setError] = useState<string | null>(null)

  // Initialisierung aus den noch offenen Mengen der Lieferung
  const initialized = items.length > 0 || !delivery || delivery.error
  if (!initialized && delivery?.items) {
    const progress = deliveryProgress(delivery)
    const openItems = progress.perProduct
      .filter((p) => p.quantityOpen > 0)
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        quantitySent: p.quantitySent,
        quantitySettled: p.quantitySettled,
        quantityReturned: p.quantityReturned,
        quantityOpen: p.quantityOpen,
        quantitySold: p.quantityOpen, // Standard: alles Offene abrechnen
        totalAmount: 0,
      }))
    setItems(openItems)
  }

  const mutation = useMutation({
    mutationFn: (data: { settledAt: string; notes: string; items: Array<{ productId: string; quantitySold: number; totalAmountCt: number }> }) =>
      fetch(`/api/deliveries/${id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Fehler beim Abrechnen')
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery', id] })
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      qc.invalidateQueries({ queryKey: ['settlements'] })
      router.push(`/deliveries/${id}`)
    },
    onError: (e: Error) => { setError(e.message); toast(e.message, 'error') },
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>
  if (!delivery || delivery.error) return <div className="p-4">Ladung nicht gefunden</div>

  const progress = deliveryProgress(delivery)
  const hasPriorSettlements = (delivery.settlements?.length || 0) > 0

  const soldItems = items.filter((i) => i.quantitySold > 0)
  const totalAmountCt = soldItems.reduce((sum, i) => sum + euroToCents(i.totalAmount), 0)
  const totalSoldQty = soldItems.reduce((sum, i) => sum + i.quantitySold, 0)
  const settlesEverythingOpen = soldItems.reduce((sum, i) => sum + i.quantitySold, 0) === progress.totalOpen

  function updateItem(idx: number, field: 'quantitySold' | 'totalAmount', value: number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const overfilled = items.find((i) => i.quantitySold > i.quantityOpen)
    if (overfilled) {
      setError(`Zu viele Stück für "${overfilled.productName}": offen sind nur ${overfilled.quantityOpen}.`)
      return
    }
    mutation.mutate({
      settledAt,
      notes,
      items: soldItems.map((i) => ({
        productId: i.productId,
        quantitySold: i.quantitySold,
        totalAmountCt: euroToCents(i.totalAmount),
      })),
    })
  }

  return (
    <div>
      <PageHeader
        title={hasPriorSettlements ? 'Weiteren Verkauf erfassen' : 'Verkauf erfassen'}
        description={`Verkäufer: ${delivery.supplier?.name}`}
      />

      {items.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          Es sind keine offenen Mengen mehr vorhanden — diese Ladung ist vollständig abgerechnet.
        </CardContent></Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
          {hasPriorSettlements && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Von dieser Ladung wurde bereits ein Teil abgerechnet. Trage hier nur die <strong>jetzt zusätzlich</strong> verkauften Mengen ein.
              Offen gesamt: <strong>{progress.totalOpen} Stück</strong>.
            </div>
          )}

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
                Trage ein, wie viele Stück diesmal verkauft wurden und den dafür erhaltenen Gesamtbetrag.
                Nicht verkaufte Stück bleiben beim Verkäufer offen und können später abgerechnet werden. (Der Bestand wurde bereits bei der Übergabe abgebucht.)
              </p>
              {items.map((item, idx) => {
                const avgPriceCt = item.quantitySold > 0 ? euroToCents(item.totalAmount) / item.quantitySold : 0
                return (
                  <div key={item.productId} className="p-4 rounded-lg border bg-muted/40">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium">{item.productName}</p>
                      <Badge variant="info">{item.quantityOpen} offen</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                      <div><span className="text-muted-foreground">Übergeben:</span> <strong>{item.quantitySent}</strong></div>
                      <div><span className="text-muted-foreground">Abgerechnet:</span> <strong>{item.quantitySettled}</strong></div>
                      <div><span className="text-muted-foreground">Retour:</span> <strong>{item.quantityReturned}</strong></div>
                      <div><span className="text-muted-foreground">Offen:</span> <strong className="text-rose-600">{item.quantityOpen}</strong></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Jetzt verkauft *</Label>
                        <Input
                          type="number"
                          min="0"
                          max={item.quantityOpen}
                          value={item.quantitySold}
                          onChange={(e) => updateItem(idx, 'quantitySold', Math.min(Number(e.target.value), item.quantityOpen))}
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
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Verkaufte Stück (diese Abrechnung)</span>
                <span>{totalSoldQty} Stück</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Gesamtbetrag</span>
                <span className="text-2xl font-bold text-green-600">{centsToEuro(totalAmountCt)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {settlesEverythingOpen
                  ? 'Damit ist die Ladung vollständig abgerechnet.'
                  : `Nach diesem Verkauf bleiben ${progress.totalOpen - totalSoldQty} Stück offen.`}
              </p>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={mutation.isPending || totalAmountCt === 0}>
            {mutation.isPending ? 'Speichern...' : 'Verkauf speichern'}
          </Button>
        </form>
      )}
    </div>
  )
}
