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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'

interface Location {
  id: string
  name: string
  type: string
  address?: string
  notes?: string
}

const LOCATION_TYPES = [
  { value: 'WAREHOUSE', label: 'Lager' },
  { value: 'STORE', label: 'Geschäft' },
  { value: 'OTHER', label: 'Sonstiges' },
]

function LocationForm({ defaultValues, onSubmit, isLoading }: {
  defaultValues?: Partial<Location>
  onSubmit: (data: Partial<Location>) => void
  isLoading?: boolean
}) {
  const [name, setName] = useState(defaultValues?.name || '')
  const [type, setType] = useState(defaultValues?.type || 'WAREHOUSE')
  const [address, setAddress] = useState(defaultValues?.address || '')
  const [notes, setNotes] = useState(defaultValues?.notes || '')

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, type, address, notes }) }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>Typ</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LOCATION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Adresse</Label>
        <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label>Notizen</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" disabled={isLoading}>Speichern</Button>
    </form>
  )
}

export default function LocationsPage() {
  const [editing, setEditing] = useState<Location | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const qc = useQueryClient()

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => fetch('/api/locations').then((r) => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Location>) => apiFetch('/api/locations', jsonInit(data)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); setDialogOpen(false); toast('Standort erstellt', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Location) => apiFetch(`/api/locations/${id}`, jsonInit(data, 'PUT')),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); setEditing(null); toast('Standort gespeichert', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/locations/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); toast('Standort gelöscht', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const typeLabel = (type: string) => LOCATION_TYPES.find((t) => t.value === type)?.label || type

  return (
    <div>
      <PageHeader
        title="Standorte"
        description="Lagerorte und Standorte verwalten"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Neuer Standort</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Standort</DialogTitle></DialogHeader>
              <LocationForm onSubmit={(d) => createMutation.mutate(d)} isLoading={createMutation.isPending} />
            </DialogContent>
          </Dialog>
        }
      />

      {!isLoading && locations.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={MapPin}
            title="Noch keine Standorte"
            description="Lege mindestens einen Lagerort an (z.B. „Hauptlager“). Standorte brauchst du, um Bestand zu führen und Ladungen zusammenzustellen."
            actionLabel="Ersten Standort anlegen"
            onAction={() => setDialogOpen(true)}
          />
        </div>
      ) : (
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
            ) : locations.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell><Badge variant="secondary">{typeLabel(l.type)}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-sm">{l.address || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Dialog open={editing?.id === l.id} onOpenChange={(o) => !o && setEditing(null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(l)}><Pencil className="h-4 w-4" /></Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Standort bearbeiten</DialogTitle></DialogHeader>
                        {editing && <LocationForm defaultValues={editing} onSubmit={(d) => updateMutation.mutate({ ...editing, ...d })} isLoading={updateMutation.isPending} />}
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm('Standort löschen?')) deleteMutation.mutate(l.id) }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
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
