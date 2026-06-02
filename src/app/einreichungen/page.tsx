'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { centsToEuro } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/toast'
import { Inbox, RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react'

type Status = 'PENDING' | 'APPLIED' | 'FAILED'

interface SubItem { productId: string; productName: string; quantitySold: number; totalAmountCt: number }
interface Submission {
  id: string
  supplierId: string
  sellerName: string | null
  deliveryId: string
  deliveryLabel: string | null
  status: Status
  settlementId: string | null
  error: string | null
  reportedAt: string | null
  createdAt: string
  appliedAt: string | null
  note: string | null
  qty: number
  totalCt: number
  items: SubItem[]
}
interface InboxResponse {
  submissions: Submission[]
  counts: Record<Status, number>
  maintenance: { unlocked: boolean; applied: number; failed: number }
}

const STATUS_LABEL: Record<Status, string> = { PENDING: 'Wird verbucht', APPLIED: 'Verbucht', FAILED: 'Problem' }
const STATUS_VARIANT: Record<Status, 'info' | 'success' | 'destructive'> = {
  PENDING: 'info',
  APPLIED: 'success',
  FAILED: 'destructive',
}

export default function EinreichungenPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<InboxResponse>({
    queryKey: ['portal-submissions'],
    queryFn: () => fetch('/api/portal-admin/submissions').then((r) => r.json()),
    refetchInterval: 60_000,
  })

  const retry = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/portal-admin/submissions/${id}/retry`, { method: 'POST' }).then((r) => r.json()),
    onSuccess: (res: { ok: boolean; status: Status; error?: string }) => {
      qc.invalidateQueries({ queryKey: ['portal-submissions'] })
      qc.invalidateQueries({ queryKey: ['settlements'] })
      if (res.ok) toast('Eingereichter Verkauf verbucht', 'success')
      else toast(res.error || 'Konnte nicht verbucht werden', 'error')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const submissions = data?.submissions ?? []
  const counts = data?.counts ?? { PENDING: 0, APPLIED: 0, FAILED: 0 }

  return (
    <div>
      <PageHeader
        title="Portal-Eingang"
        description="Von deinen Verkäufern über das Portal eingereichte Verkäufe"
        actions={
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['portal-submissions'] })}>
            <RefreshCw className="h-4 w-4" /> Aktualisieren
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Verbucht</p>
          <p className="mt-0.5 text-2xl font-bold text-emerald-600">{counts.APPLIED}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Wird verbucht</p>
          <p className="mt-0.5 text-2xl font-bold text-sky-600">{counts.PENDING}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Problem</p>
          <p className={`mt-0.5 text-2xl font-bold ${counts.FAILED > 0 ? 'text-rose-600' : 'text-neutral-400'}`}>{counts.FAILED}</p>
        </CardContent></Card>
      </div>

      {counts.FAILED > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Einige Einreichungen konnten nicht automatisch verbucht werden (z.B. mehr verkauft als offen, oder die Ladung
            wurde storniert). Prüfe sie unten und versuche es erneut, oder rechne die Ladung manuell ab.
          </span>
        </div>
      )}

      {!isLoading && submissions.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Inbox}
            title="Noch keine Einreichungen"
            description="Sobald ein Verkäufer über seinen persönlichen Portal-Link Verkäufe meldet, erscheinen sie hier — und werden automatisch als Abrechnung verbucht. Den Portal-Zugang richtest du beim jeweiligen Verkäufer ein."
            actionLabel="Zu den Verkäufern"
            actionHref="/suppliers"
          />
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Verkäufer</TableHead>
                <TableHead>Verkauf</TableHead>
                <TableHead className="text-right">Stück</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Eingereicht</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Laden...</TableCell></TableRow>
              ) : submissions.map((s) => (
                <TableRow key={s.id} className={s.status === 'FAILED' ? 'bg-rose-50/40' : ''}>
                  <TableCell className="font-medium">{s.sellerName || '—'}</TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm">{s.deliveryLabel || 'Ladung'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.items.map((i) => `${i.quantitySold}× ${i.productName}`).join(', ')}
                    </p>
                    {s.status === 'FAILED' && s.error && (
                      <p className="mt-0.5 text-xs text-rose-600">{s.error}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{s.qty}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">{centsToEuro(s.totalCt)}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {s.status === 'APPLIED' && s.settlementId ? (
                      <Link href={`/settlements/${s.settlementId}`}>
                        <Button variant="ghost" size="sm">Abrechnung <ArrowRight className="h-4 w-4" /></Button>
                      </Link>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retry.mutate(s.id)}
                        disabled={retry.isPending}
                      >
                        <RefreshCw className="h-4 w-4" /> Erneut buchen
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
