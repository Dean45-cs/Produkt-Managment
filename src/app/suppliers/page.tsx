'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'
import { DEFAULT_SETTLE_DAYS } from '@/lib/contact'
import { cn } from '@/lib/utils'

interface Supplier {
  id: string
  name: string
  contactName?: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  isSeller: boolean
  isWholesaler: boolean
  expectedSettleDays?: number | null
}

type RoleFilter = 'all' | 'seller' | 'wholesaler'

const FILTERS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'seller', label: 'Verkäufer' },
  { value: 'wholesaler', label: 'Lieferanten' },
]

function SupplierForm({ defaultValues, onSubmit, isLoading }: {
  defaultValues?: Partial<Supplier>
  onSubmit: (data: Partial<Supplier>) => void
  isLoading?: boolean
}) {
  // Neue Kontakte sind standardmäßig Verkäufer – das ist der häufigste Fall.
  const [form, setForm] = useState<Partial<Supplier>>({
    isSeller: true,
    isWholesaler: false,
    ...defaultValues,
  })
  const set = (k: keyof Supplier) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const noRole = !form.isSeller && !form.isWholesaler

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input value={form.name || ''} onChange={set('name')} required />
      </div>

      <div className="space-y-2 rounded-lg border bg-neutral-50 p-3">
        <Label>Rolle *</Label>
        <p className="text-xs text-muted-foreground">
          Ein Kontakt kann beides sein — z.B. jemand, bei dem du einkaufst und der auch für dich verkauft.
        </p>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-rose-600"
            checked={Boolean(form.isSeller)}
            onChange={(e) => setForm((f) => ({ ...f, isSeller: e.target.checked }))}
          />
          <span>
            <span className="font-medium">Verkäufer</span>
            <span className="block text-xs text-muted-foreground">Nimmt Ladungen mit und verkauft sie face2face.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-rose-600"
            checked={Boolean(form.isWholesaler)}
            onChange={(e) => setForm((f) => ({ ...f, isWholesaler: e.target.checked }))}
          />
          <span>
            <span className="font-medium">Lieferant</span>
            <span className="block text-xs text-muted-foreground">Hier bestellst du deine Ware.</span>
          </span>
        </label>
        {noRole && <p className="text-xs text-destructive">Bitte mindestens eine Rolle wählen.</p>}
      </div>

      {form.isSeller && (
        <div className="space-y-1.5">
          <Label>Abrechnung erwartet nach (Tagen)</Label>
          <Input
            type="number"
            min="1"
            max="365"
            value={form.expectedSettleDays ?? ''}
            placeholder={String(DEFAULT_SETTLE_DAYS)}
            onChange={(e) =>
              setForm((f) => ({ ...f, expectedSettleDays: e.target.value === '' ? null : Number(e.target.value) }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Danach taucht eine Ladung unter „Offene Posten“ als überfällig auf. Leer lassen für den
            Standard von {DEFAULT_SETTLE_DAYS} Tagen.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Ansprechpartner</Label>
          <Input value={form.contactName || ''} onChange={set('contactName')} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefon</Label>
          <Input value={form.phone || ''} onChange={set('phone')} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>E-Mail</Label>
        <Input type="email" value={form.email || ''} onChange={set('email')} />
      </div>
      <div className="space-y-1.5">
        <Label>Adresse</Label>
        <Textarea value={form.address || ''} onChange={set('address')} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label>Notizen</Label>
        <Input value={form.notes || ''} onChange={set('notes')} />
      </div>
      <Button type="submit" disabled={isLoading || noRole}>Speichern</Button>
    </form>
  )
}

function RoleBadges({ contact }: { contact: Supplier }) {
  if (!contact.isSeller && !contact.isWholesaler) {
    return <Badge variant="destructive">Ohne Rolle</Badge>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {contact.isSeller && <Badge variant="info">Verkäufer</Badge>}
      {contact.isWholesaler && <Badge variant="secondary">Lieferant</Badge>}
    </div>
  )
}

export default function SuppliersPage() {
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filter, setFilter] = useState<RoleFilter>('all')
  const qc = useQueryClient()

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => fetch('/api/suppliers').then((r) => r.json()),
  })

  // Die Rollen-Queries anderer Seiten (?role=…) hängen am selben Präfix und
  // werden dadurch mit invalidiert.
  const refresh = () => qc.invalidateQueries({ queryKey: ['suppliers'] })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Supplier>) => apiFetch('/api/suppliers', jsonInit(data)),
    onSuccess: () => { refresh(); setDialogOpen(false); toast('Kontakt erstellt', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Supplier) => apiFetch(`/api/suppliers/${id}`, jsonInit(data, 'PUT')),
    onSuccess: () => { refresh(); setEditing(null); toast('Kontakt gespeichert', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast('Kontakt gelöscht', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const visible = suppliers.filter((s) =>
    filter === 'seller' ? s.isSeller : filter === 'wholesaler' ? s.isWholesaler : true
  )
  const counts = {
    all: suppliers.length,
    seller: suppliers.filter((s) => s.isSeller).length,
    wholesaler: suppliers.filter((s) => s.isWholesaler).length,
  }

  return (
    <div>
      <PageHeader
        title="Verkäufer & Lieferanten"
        description="Deine Verkäufer im Außendienst und die Lieferanten, bei denen du bestellst — ein Kontakt kann beides sein."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Neuer Kontakt</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Kontakt</DialogTitle></DialogHeader>
              <SupplierForm onSubmit={(d) => createMutation.mutate(d)} isLoading={createMutation.isPending} />
            </DialogContent>
          </Dialog>
        }
      />

      {!isLoading && suppliers.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Users}
            title="Noch keine Kontakte"
            description="Lege deine Verkäufer (Außendienst) an, die Ware bei dir abholen und face2face verkaufen, und die Lieferanten, bei denen du bestellst."
            actionLabel="Ersten Kontakt anlegen"
            onAction={() => setDialogOpen(true)}
          />
        </div>
      ) : (
      <>
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                filter === f.value
                  ? 'border-rose-600 bg-rose-600 text-white'
                  : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              )}
            >
              {f.label} <span className="opacity-70">({counts[f.value]})</span>
            </button>
          ))}
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Ansprechpartner</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="text-right">Frist</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : visible.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Kein Kontakt mit dieser Rolle.
                </TableCell></TableRow>
              ) : visible.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link href={`/suppliers/${s.id}`} className="text-rose-600 hover:underline">{s.name}</Link>
                  </TableCell>
                  <TableCell><RoleBadges contact={s} /></TableCell>
                  <TableCell>{s.contactName || '—'}</TableCell>
                  <TableCell>{s.email || '—'}</TableCell>
                  <TableCell>{s.phone || '—'}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {s.isSeller ? `${s.expectedSettleDays ?? DEFAULT_SETTLE_DAYS} T.` : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Dialog open={editing?.id === s.id} onOpenChange={(o) => !o && setEditing(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Kontakt bearbeiten</DialogTitle></DialogHeader>
                          {editing && <SupplierForm defaultValues={editing} onSubmit={(d) => updateMutation.mutate({ ...editing, ...d })} isLoading={updateMutation.isPending} />}
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm('Löschen?')) deleteMutation.mutate(s.id) }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
      )}
    </div>
  )
}
