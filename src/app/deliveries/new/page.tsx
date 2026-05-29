'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { centsToDecimal, euroToCents } from '@/lib/money'
import { Plus, Trash2 } from 'lucide-react'

interface DeliveryItem {
  productId: string
  locationId: string
  quantitySent: number
  expectedPriceCt: number
  batchNumber: string
}

export default function NewDeliveryPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DeliveryItem[]>([{ productId: '', locationId: '', quantitySent: 1, expectedPriceCt: 0, batchNumber: '' }])

  const { data: suppliers = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['suppliers'],
    queryFn: () => fetch('/api/suppliers').then((r) => r.json()),
  })
  const { data: products = [] } = useQuery<Array<{ id: string; name: string; sku: string; purchasePriceCt: number }>>({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()),
  })
  const { data: locations = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['locations'],
    queryFn: () => fetch('/api/locations').then((r) => r.json()),
  })

  const mutation = useMutation({
    mutationFn: (data: { supplierId: string; notes: string; items: DeliveryItem[] }) =>
      fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      router.push(`/deliveries/${d.id}`)
    },
  })

  function updateItem(idx: number, field: keyof DeliveryItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function addItem() {
    setItems((prev) => [...prev, { productId: '', locationId: '', quantitySent: 1, expectedPriceCt: 0, batchNumber: '' }])
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) return alert('Bitte Lieferant auswählen')
    if (items.some((i) => !i.productId || !i.locationId)) return alert('Alle Positionen ausfüllen')
    mutation.mutate({ supplierId, notes, items })
  }

  return (
    <div>
      <PageHeader title="Neue Lieferung" description="Lieferung an Distributor anlegen" />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle>Allgemein</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Lieferant *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Lieferant auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notizen</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Positionen</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" /> Position hinzufügen
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg border bg-gray-50 space-y-3">
                <div className="grid grid-cols-5 gap-3 items-end">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Produkt</Label>
                    <Select value={item.productId} onValueChange={(v) => {
                      const p = products.find((pr) => pr.id === v)
                      updateItem(idx, 'productId', v)
                      if (p) updateItem(idx, 'expectedPriceCt', p.purchasePriceCt)
                    }}>
                      <SelectTrigger><SelectValue placeholder="Produkt..." /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Standort</Label>
                    <Select value={item.locationId} onValueChange={(v) => updateItem(idx, 'locationId', v)}>
                      <SelectTrigger><SelectValue placeholder="Lager..." /></SelectTrigger>
                      <SelectContent>
                        {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Menge</Label>
                    <Input type="number" min="1" value={item.quantitySent} onChange={(e) => updateItem(idx, 'quantitySent', Number(e.target.value))} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label>Erw. Preis (€)</Label>
                      <Input type="number" step="0.01" min="0" value={centsToDecimal(item.expectedPriceCt)} onChange={(e) => updateItem(idx, 'expectedPriceCt', euroToCents(Number(e.target.value)))} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} className="mt-5 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 max-w-xs">
                  <Label>Chargen-/Lot-Nr. (optional)</Label>
                  <Input value={item.batchNumber} onChange={(e) => updateItem(idx, 'batchNumber', e.target.value)} placeholder="z.B. LOT-2024-001" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Speichern...' : 'Lieferung anlegen'}
        </Button>
      </form>
    </div>
  )
}
