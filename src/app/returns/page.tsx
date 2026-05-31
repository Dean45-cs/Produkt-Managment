'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { Plus, RotateCcw } from 'lucide-react'

interface Return {
  id: string
  returnDate: string
  notes?: string
  delivery?: { supplier: { name: string } }
  items: Array<{ quantityReturned: number; product: { name: string } }>
}

export default function ReturnsPage() {
  const { data: returns = [], isLoading } = useQuery<Return[]>({
    queryKey: ['returns'],
    queryFn: () => fetch('/api/returns').then((r) => r.json()),
  })

  return (
    <div>
      <PageHeader
        title="Retouren"
        description="Ware, die Verkäufer zurückgeben (kommt zurück ins Lager)"
        actions={
          <Link href="/returns/new">
            <Button><Plus className="h-4 w-4" /> Neue Retoure</Button>
          </Link>
        }
      />

      {!isLoading && returns.length === 0 ? (
        <Card><CardContent className="p-0">
          <EmptyState
            icon={RotateCcw}
            title="Noch keine Retouren"
            description="Wenn ein Verkäufer unverkaufte Ware zurückgibt, erfasse sie hier. Der Bestand wird automatisch wieder erhöht."
            actionHref="/returns/new"
            actionLabel="Erste Retoure erfassen"
          />
        </CardContent></Card>
      ) : (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Verkäufer</TableHead>
                <TableHead>Positionen</TableHead>
                <TableHead>Stück gesamt</TableHead>
                <TableHead>Notizen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : returns.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.returnDate)}</TableCell>
                  <TableCell>{r.delivery?.supplier?.name || '—'}</TableCell>
                  <TableCell>{r.items.length}</TableCell>
                  <TableCell>{r.items.reduce((s, i) => s + i.quantityReturned, 0)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
