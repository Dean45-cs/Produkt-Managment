'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { centsToEuro } from '@/lib/money'
import { ExportButton } from '@/components/ExportButton'
import { Plus, Search, Pencil, Trash2, Eye, Package } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/toast'

interface Product {
  id: string
  name: string
  sku: string
  unit: string
  imageUrl?: string | null
  purchasePriceCt: number
  minStockLevel: number
  reorderPoint: number
  totalStock: number
  needsReorder: boolean
  category?: { name: string; color?: string }
}

function StockBadge({ stock, min, reorder }: { stock: number; min: number; reorder: number }) {
  if (stock === 0) return <Badge variant="destructive">Kein Bestand</Badge>
  if (stock <= reorder) return <Badge variant="warning">Nachbestellen</Badge>
  if (stock <= min) return <Badge variant="warning">Niedrig</Badge>
  return <Badge variant="success">OK</Badge>
}

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', search],
    queryFn: () => fetch(`/api/products?search=${search}`).then((r) => r.json()),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast('Produkt gelöscht', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <div>
      <PageHeader
        title="Produkte"
        description="Alle Produkte verwalten"
        actions={
          <>
            <ExportButton href="/api/export/products" />
            <Link href="/products/new">
              <Button><Plus className="h-4 w-4" /> Neues Produkt</Button>
            </Link>
          </>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Einheit</TableHead>
              <TableHead>EK-Preis</TableHead>
              <TableHead>Bestand</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
            ) : products.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Keine Produkte gefunden</TableCell></TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} className="h-8 w-8 rounded object-cover border" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-gray-100 border flex items-center justify-center text-gray-300">
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                      {p.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.category && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: p.category.color ? p.category.color + '20' : '#e5e7eb', color: p.category.color || '#374151' }}
                      >
                        {p.category.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell>{centsToEuro(p.purchasePriceCt)}</TableCell>
                  <TableCell>{p.totalStock}</TableCell>
                  <TableCell>
                    <StockBadge stock={p.totalStock} min={p.minStockLevel} reorder={p.reorderPoint} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/products/${p.id}`}>
                        <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      <Link href={`/products/${p.id}/edit`}>
                        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { if (confirm('Produkt deaktivieren?')) deleteMutation.mutate(p.id) }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
