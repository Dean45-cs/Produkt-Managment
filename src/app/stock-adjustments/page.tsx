'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ExportButton } from '@/components/ExportButton'
import { formatDate } from '@/lib/utils'

const REASON_LABELS: Record<string, string> = {
  INITIAL_STOCK: 'Anfangsbestand',
  PURCHASE_RECEIVED: 'Wareneingang',
  MANUAL_CORRECTION: 'Manuelle Korrektur',
  DAMAGED: 'Beschädigt',
  EXPIRED: 'Abgelaufen',
  FOUND: 'Gefunden',
  RETURN_FROM_SUPPLIER: 'Retoure',
  DELIVERY_SENT: 'Lieferung',
  OTHER: 'Sonstiges',
}

interface Movement {
  id: string
  delta: number
  reason: string
  note?: string
  createdAt: string
  product: { name: string; sku: string }
  location: { name: string }
}

export default function StockMovementsPage() {
  const [search, setSearch] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')

  const { data: movements = [], isLoading } = useQuery<Movement[]>({
    queryKey: ['stock-adjustments'],
    queryFn: () => fetch('/api/stock-adjustments').then((r) => r.json()),
  })

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (reasonFilter && m.reason !== reasonFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!m.product.name.toLowerCase().includes(q) && !m.product.sku.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [movements, search, reasonFilter])

  // Nur tatsächlich vorkommende Gründe als Filteroptionen anbieten
  const usedReasons = useMemo(
    () => Array.from(new Set(movements.map((m) => m.reason))),
    [movements]
  )

  return (
    <div>
      <PageHeader
        title="Lagerbewegungen"
        description="Lückenloses Protokoll aller Bestandsveränderungen"
        actions={<ExportButton href="/api/export/stock-movements" />}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          placeholder="Produkt oder SKU suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={reasonFilter || 'all'} onValueChange={(v) => setReasonFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Alle Gründe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Gründe</SelectItem>
            {usedReasons.map((r) => (
              <SelectItem key={r} value={r}>{REASON_LABELS[r] || r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || reasonFilter) && (
          <span className="text-sm text-muted-foreground">{filtered.length} von {movements.length}</span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Produkt</TableHead>
                <TableHead>Standort</TableHead>
                <TableHead>Menge</TableHead>
                <TableHead>Grund</TableHead>
                <TableHead>Notiz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Bewegungen gefunden</TableCell></TableRow>
              ) : filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">{formatDate(a.createdAt)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{a.product.name}</p>
                      <p className="text-xs text-muted-foreground">{a.product.sku}</p>
                    </div>
                  </TableCell>
                  <TableCell>{a.location.name}</TableCell>
                  <TableCell>
                    <span className={a.delta > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {a.delta > 0 ? '+' : ''}{a.delta}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{REASON_LABELS[a.reason] || a.reason}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{a.note || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
