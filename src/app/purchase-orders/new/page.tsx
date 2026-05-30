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
import { Plus, Trash2, Wand2 } from 'lucide-react'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'

interface OrderItem {
  productId: string
  quantityOrdered: number
  unitPriceCt: number
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<OrderItem[]>([{ productId: '', quantityOrdered: 1, unitPriceCt: 0 }])

  const { data: suppliers = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['suppliers'],
    queryFn: () => fetch('/api/suppliers').then((r) => r.json()),
  })
  const { data: products = [] } = useQuery<Array<{ id: string; name: string; sku: string; purchasePriceCt: number }>>({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()),
  })

  const mutation = useMutation({
    mutationFn: async (data: { supplierId: string; notes: string; items: OrderItem[] }) => {
      const res = await apiFetch('/api/purchase-orders', jsonInit(data))
      return res.json()
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      router.push(`/purchase-orders/${d.id}`)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  async function loadSuggestions() {
    setLoadingSuggestions(true)
    try {
      const suggestions: Array<{ productId: string; suggestedQty: number; unitPriceCt: number }> =
        await fetch('/api/purchase-orders/suggestions').then((r) => r.json())
      if (!suggestions.length) {
        alert('Aktuell sind keine Produkte unter dem Nachbestellpunkt.')
        return
      }
      setItems(suggestions.map((s) => ({
        productId: s.productId,
        quantityOrdered: s.suggestedQty,
        unitPriceCt: s.unitPriceCt,
      })))
    } finally {
      setLoadingSuggestions(false)
    }
  }

  function updateItem(idx: number, field: keyof OrderItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({ supplierId, notes, items })
  }

  return (
    <div>
      <PageHeader title="Neue Einkaufsbestellung" />
      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle>Allgemein</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Lieferant (optional)</Label>
              <Select value={supplierId || 'none'} onValueChange={(v) => setSupplierId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Kein Lieferant" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Lieferant</SelectItem>
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
              <CardTitle>Produkte</CardTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={loadSuggestions} disabled={loadingSuggestions}>
                  <Wand2 className="h-4 w-4" /> {loadingSuggestions ? 'Lädt...' : 'Nachbestellvorschläge'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, { productId: '', quantityOrdered: 1, unitPriceCt: 0 }])}>
                  <Plus className="h-4 w-4" /> Produkt hinzufügen
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-3 items-end p-3 rounded-lg border bg-gray-50">
                <div className="col-span-2 space-y-1.5">
                  <Label>Produkt</Label>
                  <Select value={item.productId} onValueChange={(v) => {
                    const p = products.find((pr) => pr.id === v)
                    updateItem(idx, 'productId', v)
                    if (p) updateItem(idx, 'unitPriceCt', p.purchasePriceCt)
                  }}>
                    <SelectTrigger><SelectValue placeholder="Produkt wählen..." /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Menge</Label>
                  <Input type="number" min="1" value={item.quantityOrdered} onChange={(e) => updateItem(idx, 'quantityOrdered', Number(e.target.value))} />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label>EK-Preis (€)</Label>
                    <Input type="number" step="0.01" min="0" value={centsToDecimal(item.unitPriceCt)} onChange={(e) => updateItem(idx, 'unitPriceCt', euroToCents(Number(e.target.value)))} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Speichern...' : 'Bestellung erstellen'}
        </Button>
      </form>
    </div>
  )
}
