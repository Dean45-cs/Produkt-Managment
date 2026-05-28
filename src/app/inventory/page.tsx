'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { centsToEuro } from '@/lib/money'
import { SlidersHorizontal } from 'lucide-react'

interface InventoryData {
  inventory: Array<{
    id: string
    productId: string
    locationId: string
    quantity: number
    product: { name: string; sku: string; purchasePriceCt: number; minStockLevel: number; reorderPoint: number }
    location: { name: string }
  }>
  locations: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string }>
}

function AdjustDialog({ productId, locationId, productName, locationName }: {
  productId: string; locationId: string; productName: string; locationName: string
}) {
  const [delta, setDelta] = useState(0)
  const [reason, setReason] = useState('MANUAL_CORRECTION')
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, locationId, delta: Number(delta), reason, note }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); setOpen(false); setDelta(0) },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><SlidersHorizontal className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Bestand korrigieren</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{productName} @ {locationName}</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Menge (positiv = hinzufügen, negativ = entfernen)</Label>
            <Input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Grund</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INITIAL_STOCK">Anfangsbestand</SelectItem>
                <SelectItem value="MANUAL_CORRECTION">Manuelle Korrektur</SelectItem>
                <SelectItem value="DAMAGED">Beschädigt</SelectItem>
                <SelectItem value="FOUND">Gefunden</SelectItem>
                <SelectItem value="OTHER">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notiz</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>Speichern</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function InventoryPage() {
  const [filterLocation, setFilterLocation] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery<InventoryData>({
    queryKey: ['inventory'],
    queryFn: () => fetch('/api/inventory').then((r) => r.json()),
  })

  const filtered = data?.inventory.filter((inv) => {
    if (filterLocation && inv.locationId !== filterLocation) return false
    if (search && !inv.product.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }) || []

  return (
    <div>
      <PageHeader title="Bestand" description="Lagerbestand je Produkt und Standort" />

      <div className="flex items-center gap-2 mb-4">
        <Input
          placeholder="Produkt suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filterLocation || 'all'} onValueChange={(v) => setFilterLocation(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Alle Standorte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Standorte</SelectItem>
            {data?.locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produkt</TableHead>
                <TableHead>Standort</TableHead>
                <TableHead>Menge</TableHead>
                <TableHead>Wert</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Kein Bestand gefunden</TableCell></TableRow>
              ) : filtered.map((inv) => {
                const val = inv.quantity * inv.product.purchasePriceCt
                const isOut = inv.quantity === 0
                const isLow = inv.quantity > 0 && inv.quantity <= inv.product.reorderPoint
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{inv.product.name}</p>
                        <p className="text-xs text-muted-foreground">{inv.product.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>{inv.location.name}</TableCell>
                    <TableCell className="font-medium">{inv.quantity}</TableCell>
                    <TableCell>{centsToEuro(val)}</TableCell>
                    <TableCell>
                      {isOut ? <Badge variant="destructive">Leer</Badge> :
                       isLow ? <Badge variant="warning">Niedrig</Badge> :
                       <Badge variant="success">OK</Badge>}
                    </TableCell>
                    <TableCell>
                      <AdjustDialog
                        productId={inv.productId}
                        locationId={inv.locationId}
                        productName={inv.product.name}
                        locationName={inv.location.name}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
