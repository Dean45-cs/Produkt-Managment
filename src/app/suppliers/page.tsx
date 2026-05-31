'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'

interface Supplier {
  id: string
  name: string
  contactName?: string
  email?: string
  phone?: string
  address?: string
  notes?: string
}

function SupplierForm({ defaultValues, onSubmit, isLoading }: {
  defaultValues?: Partial<Supplier>
  onSubmit: (data: Partial<Supplier>) => void
  isLoading?: boolean
}) {
  const [form, setForm] = useState<Partial<Supplier>>(defaultValues || {})
  const set = (k: keyof Supplier) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input value={form.name || ''} onChange={set('name')} required />
      </div>
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
      <Button type="submit" disabled={isLoading}>Speichern</Button>
    </form>
  )
}

export default function SuppliersPage() {
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const qc = useQueryClient()

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => fetch('/api/suppliers').then((r) => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Supplier>) => apiFetch('/api/suppliers', jsonInit(data)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setDialogOpen(false); toast('Verkäufer erstellt', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Supplier) => apiFetch(`/api/suppliers/${id}`, jsonInit(data, 'PUT')),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setEditing(null); toast('Verkäufer gespeichert', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast('Verkäufer gelöscht', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <div>
      <PageHeader
        title="Verkäufer"
        description="Deine Verkäufer (Außendienst) verwalten"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Neuer Verkäufer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Verkäufer</DialogTitle></DialogHeader>
              <SupplierForm onSubmit={(d) => createMutation.mutate(d)} isLoading={createMutation.isPending} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Ansprechpartner</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Noch keine Verkäufer angelegt</TableCell></TableRow>
            ) : suppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.contactName || '—'}</TableCell>
                <TableCell>{s.email || '—'}</TableCell>
                <TableCell>{s.phone || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Dialog open={editing?.id === s.id} onOpenChange={(o) => !o && setEditing(null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Verkäufer bearbeiten</DialogTitle></DialogHeader>
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
    </div>
  )
}
