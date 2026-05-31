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
import { Plus, Trash2 } from 'lucide-react'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'
import { formatDate } from '@/lib/utils'

interface ReturnItem {
  productId: string
  locationId: string
  quantityReturned: number
}

export default function NewReturnPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [deliveryId, setDeliveryId] = useState('')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ReturnItem[]>([{ productId: '', locationId: '', quantityReturned: 1 }])

  const { data: deliveries = [] } = useQuery<Array<{ id: string; supplier: { name: string }; createdAt: string; status: string }>>({
    queryKey: ['deliveries'],
    queryFn: () => fetch('/api/deliveries').then((r) => r.json()),
  })
  const { data: products = [] } = useQuery<Array<{ id: string; name: string; sku: string }>>({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()),
  })
  const { data: locations = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['locations'],
    queryFn: () => fetch('/api/locations').then((r) => r.json()),
  })

  const mutation = useMutation({
    mutationFn: async (data: { deliveryId?: string; returnDate: string; notes: string; items: ReturnItem[] }) => {
      const res = await apiFetch('/api/returns', jsonInit(data))
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      router.push('/returns')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function updateItem(idx: number, field: keyof ReturnItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.some((i) => !i.productId || !i.locationId)) return toast('Bitte bei jeder Position Produkt und Ziel-Standort wählen', 'error')
    mutation.mutate({ deliveryId: deliveryId || undefined, returnDate, notes, items })
  }

  return (
    <div>
      <PageHeader title="Neue Retoure" description="Rücksendung erfassen — Bestand wird automatisch erhöht" />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle>Allgemein</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Retouredatum</Label>
                <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Zugehörige Ladung (optional)</Label>
                <Select value={deliveryId || 'none'} onValueChange={(v) => setDeliveryId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Keine Ladung" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    {deliveries.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.supplier.name} · {formatDate(d.createdAt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notizen / Grund</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Produkte</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, { productId: '', locationId: '', quantityReturned: 1 }])}>
                <Plus className="h-4 w-4" /> Produkt hinzufügen
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-3 items-end p-3 rounded-lg border bg-muted/40">
                <div className="col-span-2 space-y-1.5">
                  <Label>Produkt</Label>
                  <Select value={item.productId} onValueChange={(v) => updateItem(idx, 'productId', v)}>
                    <SelectTrigger><SelectValue placeholder="Produkt..." /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Ziel-Standort</Label>
                  <Select value={item.locationId} onValueChange={(v) => updateItem(idx, 'locationId', v)}>
                    <SelectTrigger><SelectValue placeholder="Lager..." /></SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label>Menge</Label>
                    <Input type="number" min="1" value={item.quantityReturned} onChange={(e) => updateItem(idx, 'quantityReturned', Number(e.target.value))} />
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
          {mutation.isPending ? 'Speichern...' : 'Retoure erfassen'}
        </Button>
      </form>
    </div>
  )
}
