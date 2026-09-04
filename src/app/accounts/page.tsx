'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { ExportButton } from '@/components/ExportButton'
import { centsToDecimal, centsToEuro, euroToCents } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'
import {
  ACCOUNT_KIND, CATEGORIES_BY_KIND, ENTRY_CATEGORY, ENTRY_CATEGORY_LABELS,
  ENTRY_KIND, ENTRY_KIND_LABELS, ENTRY_KIND_VARIANTS,
} from '@/lib/accounts'
import {
  ArrowRightLeft, Banknote, Coins, Landmark, Minus, Plus, Trash2, Wallet,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

/* ----------------------------- Typen ----------------------------- */

interface Account {
  id: string
  name: string
  kind: string
  isReserve: boolean
  notes?: string | null
  balanceCt: number
}

interface AccountsResponse {
  accounts: Account[]
  totals: { cashCt: number; reserveCt: number }
  unbookedSettlements: Array<{ id: string; settledAt: string; totalAmountCt: number; sellerName: string }>
  unbookedOrders: Array<{ id: string; createdAt: string; orderedAt: string | null; supplierName: string | null; totalCt: number }>
}

interface BookEntry {
  id: string
  bookedAt: string
  amountCt: number
  kind: string
  category?: string | null
  note?: string | null
  transferId?: string | null
  account: { id: string; name: string }
  settlement?: { id: string; delivery: { supplier: { name: string } } } | null
  purchaseOrder?: { id: string; supplier?: { name: string } | null } | null
}

const euro = (ct: number) => centsToEuro(ct)

/** Vorbelegung, wenn eine Buchung aus einem Beleg heraus angestoßen wird. */
interface Prefill {
  amountCt?: number
  note?: string
  category?: string
  settlementId?: string
  purchaseOrderId?: string
}

/* --------------------------- Buchungsdialog --------------------------- */

function EntryDialog({ kind, accounts, open, onOpenChange, prefill }: {
  kind: string
  accounts: Account[]
  open: boolean
  onOpenChange: (open: boolean) => void
  prefill?: Prefill
}) {
  const qc = useQueryClient()
  const isTransfer = kind === ENTRY_KIND.TRANSFER
  const today = new Date().toISOString().slice(0, 10)

  // Die Vorbelegung ändert sich, wenn ein anderer Beleg angeklickt wird —
  // der key am Dialog-Inhalt sorgt dafür, dass das Formular neu aufgebaut wird.
  const [amountEuro, setAmountEuro] = useState(
    prefill?.amountCt ? String(centsToDecimal(prefill.amountCt)) : ''
  )
  const [bookedAt, setBookedAt] = useState(today)
  const [note, setNote] = useState(prefill?.note ?? '')
  const [category, setCategory] = useState(prefill?.category ?? CATEGORIES_BY_KIND[kind]?.[0] ?? '')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [fromAccountId, setFromAccountId] = useState(accounts.find((a) => !a.isReserve)?.id ?? '')
  const [toAccountId, setToAccountId] = useState(accounts.find((a) => a.isReserve)?.id ?? '')

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch('/api/book-entries', jsonInit(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['book-entries'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onOpenChange(false)
      toast('Buchung gespeichert', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const amountCt = euroToCents(Number(amountEuro))
  const valid =
    amountCt > 0 && (isTransfer ? fromAccountId && toAccountId && fromAccountId !== toAccountId : Boolean(accountId))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      isTransfer
        ? { kind, amountCt, bookedAt, note, fromAccountId, toAccountId }
        : {
            kind, amountCt, bookedAt, note, category: category || null, accountId,
            settlementId: prefill?.settlementId ?? null,
            purchaseOrderId: prefill?.purchaseOrderId ?? null,
          }
    )
  }

  const title = isTransfer ? 'Geld umbuchen' : `Neue ${ENTRY_KIND_LABELS[kind]}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Betrag (€) *</Label>
            <Input
              type="number" step="0.01" min="0.01" autoFocus
              value={amountEuro}
              onChange={(e) => setAmountEuro(e.target.value)}
              required
            />
          </div>

          {isTransfer ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Von *</Label>
                <Select value={fromAccountId} onValueChange={setFromAccountId}>
                  <SelectTrigger><SelectValue placeholder="Konto wählen..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Auf *</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger><SelectValue placeholder="Konto wählen..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Konto *</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Konto wählen..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kategorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Kategorie wählen..." /></SelectTrigger>
                  <SelectContent>
                    {(CATEGORIES_BY_KIND[kind] ?? []).map((c) => (
                      <SelectItem key={c} value={c}>{ENTRY_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Datum</Label>
            <Input type="date" value={bookedAt} onChange={(e) => setBookedAt(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Notiz</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. wofür oder von wem"
            />
          </div>

          {isTransfer && fromAccountId && fromAccountId === toAccountId && (
            <p className="text-xs text-destructive">Quell- und Zielkonto müssen verschieden sein.</p>
          )}

          <Button type="submit" disabled={!valid || mutation.isPending}>
            {mutation.isPending ? 'Speichern...' : 'Buchen'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------- Seite ------------------------------- */

export default function AccountsPage() {
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<{ kind: string; prefill?: Prefill } | null>(null)
  const [filterAccount, setFilterAccount] = useState('all')
  const [filterKind, setFilterKind] = useState('all')

  const { data, isLoading } = useQuery<AccountsResponse>({
    queryKey: ['accounts'],
    queryFn: () => fetch('/api/accounts').then((r) => r.json()),
  })

  const { data: entries = [] } = useQuery<BookEntry[]>({
    queryKey: ['book-entries', filterAccount, filterKind],
    queryFn: () => {
      const sp = new URLSearchParams()
      if (filterAccount !== 'all') sp.set('accountId', filterAccount)
      if (filterKind !== 'all') sp.set('kind', filterKind)
      return fetch(`/api/book-entries?${sp}`).then((r) => r.json())
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/book-entries/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['book-entries'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast('Buchung gelöscht', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const accounts = data?.accounts ?? []

  // Einnahmen und Ausgaben je Monat. Umbuchungen bleiben außen vor: sie
  // verschieben Geld nur zwischen den eigenen Töpfen.
  const monthly = useMemo(() => {
    const byMonth = new Map<string, { period: string; Einnahmen: number; Ausgaben: number }>()
    for (const e of entries) {
      if (e.kind === ENTRY_KIND.TRANSFER) continue
      const d = new Date(e.bookedAt)
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const row = byMonth.get(period) ?? { period, Einnahmen: 0, Ausgaben: 0 }
      if (e.amountCt >= 0) row.Einnahmen += e.amountCt / 100
      else row.Ausgaben += Math.abs(e.amountCt) / 100
      byMonth.set(period, row)
    }
    return Array.from(byMonth.values()).sort((a, b) => a.period.localeCompare(b.period))
  }, [entries])

  const unbookedSettlements = data?.unbookedSettlements ?? []
  const unbookedOrders = data?.unbookedOrders ?? []

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>

  return (
    <div>
      <PageHeader
        title="Kasse & Bank"
        description="Was ist reingekommen, was ist raus und was liegt als Rücklage für die nächste Bestellung bereit? Gebucht wird ausschließlich von Hand."
        actions={
          <>
            <Button size="sm" onClick={() => setDialog({ kind: ENTRY_KIND.INCOME })}>
              <Plus className="h-4 w-4" /> Einnahme
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: ENTRY_KIND.EXPENSE })}>
              <Minus className="h-4 w-4" /> Ausgabe
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog({ kind: ENTRY_KIND.TRANSFER })}>
              <ArrowRightLeft className="h-4 w-4" /> Umbuchen
            </Button>
          </>
        }
      />

      {accounts.length === 0 ? (
        <Card><CardContent className="p-0">
          <EmptyState
            icon={Wallet}
            title="Noch keine Konten"
            description="Die Standardkonten Kasse und Bank werden beim ersten Start angelegt. Fehlen sie, lege sie über die API an."
          />
        </CardContent></Card>
      ) : (
        <>
          {/* Salden */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {accounts.map((a) => (
              <Card key={a.id} className={a.isReserve ? 'border-emerald-200 bg-emerald-50/40' : ''}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {a.name}
                        {a.isReserve && <Badge variant="success">Rücklage</Badge>}
                      </p>
                      <p className={`text-2xl font-bold mt-1 ${a.balanceCt < 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                        {euro(a.balanceCt)}
                      </p>
                      {a.notes && <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>}
                    </div>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${
                      a.isReserve ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {a.kind === ACCOUNT_KIND.BANK ? <Landmark className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Noch nicht verbucht */}
          {(unbookedSettlements.length > 0 || unbookedOrders.length > 0) && (
            <Card className="mb-6 border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-600" /> Noch nicht verbucht
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Belege, zu denen noch keine Buchung existiert. Ein Klick öffnet die Buchung mit
                  vorbelegtem Betrag — gespeichert wird sie erst, wenn du sie abschickst.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {unbookedSettlements.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        Abrechnung <Link href={`/settlements/${s.id}`} className="text-rose-600 hover:underline">{s.sellerName}</Link>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(s.settledAt)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-medium text-emerald-600">{euro(s.totalAmountCt)}</span>
                      <Button
                        size="sm"
                        onClick={() => setDialog({
                          kind: ENTRY_KIND.INCOME,
                          prefill: {
                            amountCt: s.totalAmountCt,
                            category: ENTRY_CATEGORY.SALE,
                            note: `Abrechnung ${s.sellerName}`,
                            settlementId: s.id,
                          },
                        })}
                      >
                        Als Einnahme buchen
                      </Button>
                    </div>
                  </div>
                ))}
                {unbookedOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        Bestellung{' '}
                        <Link href={`/purchase-orders/${o.id}`} className="text-rose-600 hover:underline">
                          {o.supplierName ?? 'ohne Lieferant'}
                        </Link>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(o.orderedAt || o.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-medium text-red-600">{euro(o.totalCt)}</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDialog({
                          kind: ENTRY_KIND.EXPENSE,
                          prefill: {
                            amountCt: o.totalCt,
                            category: ENTRY_CATEGORY.PURCHASE,
                            note: `Bestellung ${o.supplierName ?? ''}`.trim(),
                            purchaseOrderId: o.id,
                          },
                        })}
                      >
                        Als Ausgabe buchen
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Verlauf */}
          {monthly.length > 0 && (
            <Card className="mb-6">
              <CardHeader><CardTitle>Einnahmen &amp; Ausgaben je Monat</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
                    <Legend />
                    <Bar dataKey="Einnahmen" fill="#10b981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Ausgaben" fill="#e11d48" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Buchungen */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle>Buchungen</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Konten</SelectItem>
                      {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterKind} onValueChange={setFilterKind}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Arten</SelectItem>
                      {Object.entries(ENTRY_KIND_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ExportButton href="/api/export/book-entries" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Noch keine Buchungen"
                  description="Sobald ein Verkäufer abgerechnet hat, buchst du das Geld hier als Einnahme in die Kasse."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Konto</TableHead>
                      <TableHead>Art</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Notiz</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{formatDate(e.bookedAt)}</TableCell>
                        <TableCell className="font-medium">{e.account.name}</TableCell>
                        <TableCell>
                          <Badge variant={ENTRY_KIND_VARIANTS[e.kind]}>{ENTRY_KIND_LABELS[e.kind]}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {e.category ? ENTRY_CATEGORY_LABELS[e.category] ?? e.category : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">{e.note || '—'}</TableCell>
                        <TableCell className={`text-right font-medium ${e.amountCt < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {euro(e.amountCt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const msg = e.transferId
                                ? 'Umbuchung löschen? Beide Hälften werden entfernt.'
                                : 'Buchung löschen?'
                              if (confirm(msg)) deleteMutation.mutate(e.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {dialog && (
        <EntryDialog
          key={`${dialog.kind}-${dialog.prefill?.settlementId ?? dialog.prefill?.purchaseOrderId ?? 'neu'}`}
          kind={dialog.kind}
          prefill={dialog.prefill}
          accounts={accounts}
          open
          onOpenChange={(o) => !o && setDialog(null)}
        />
      )}
    </div>
  )
}
