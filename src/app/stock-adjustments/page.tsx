'use client'

import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

export default function StockAdjustmentsPage() {
  const { data: adjustments = [], isLoading } = useQuery<Array<{
    id: string
    delta: number
    reason: string
    note?: string
    createdAt: string
    product: { name: string; sku: string }
    location: { name: string }
  }>>({
    queryKey: ['stock-adjustments'],
    queryFn: () => fetch('/api/stock-adjustments').then((r) => r.json()),
  })

  return (
    <div>
      <PageHeader title="Bestandskorrekturen" description="Protokoll aller Bestandsveränderungen" />

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
              ) : adjustments.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Noch keine Korrekturen</TableCell></TableRow>
              ) : adjustments.map((a) => (
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
