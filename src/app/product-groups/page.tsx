'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { Plus, Pencil, Trash2, Layers } from 'lucide-react'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'

interface ProductGroup {
  id: string
  name: string
  description?: string | null
  categoryId?: string | null
  category?: { id: string; name: string } | null
  _count?: { products: number }
}

const NO_CATEGORY = '__none__'

function GroupForm({ defaultValues, onSubmit, isLoading }: {
  defaultValues?: Partial<ProductGroup>
  onSubmit: (data: Partial<ProductGroup>) => void
  isLoading?: boolean
}) {
  const [name, setName] = useState(defaultValues?.name || '')
  const [description, setDescription] = useState(defaultValues?.description || '')
  const [categoryId, setCategoryId] = useState(defaultValues?.categoryId || NO_CATEGORY)

  const { data: categories = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['categories'],
    queryFn: () => fetch('/api/categories').then((r) => r.json()),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ name, description, categoryId: categoryId === NO_CATEGORY ? null : categoryId })
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Kaffee" required />
        <p className="text-xs text-muted-foreground">
          Die Art fasst mehrere Sorten zusammen. Die Sorten selbst legst du als Produkte an.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Beschreibung</Label>
        <Input value={description || ''} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Kategorie</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Ohne Kategorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY}>Ohne Kategorie</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isLoading}>Speichern</Button>
    </form>
  )
}

export default function ProductGroupsPage() {
  const [editing, setEditing] = useState<ProductGroup | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const qc = useQueryClient()

  const { data: groups = [], isLoading } = useQuery<ProductGroup[]>({
    queryKey: ['product-groups'],
    queryFn: () => fetch('/api/product-groups').then((r) => r.json()),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['product-groups'] })
    qc.invalidateQueries({ queryKey: ['products'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: Partial<ProductGroup>) => apiFetch('/api/product-groups', jsonInit(data)),
    onSuccess: () => { refresh(); setDialogOpen(false); toast('Art erstellt', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: ProductGroup) => apiFetch(`/api/product-groups/${id}`, jsonInit(data, 'PUT')),
    onSuccess: () => { refresh(); setEditing(null); toast('Art gespeichert', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/product-groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast('Art gelöscht', 'success') },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <div>
      <PageHeader
        title="Arten"
        description="Fasse deine Produkte zu Arten zusammen — jede Art hat mehrere Sorten, die du als Produkte anlegst."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Neue Art</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neue Art</DialogTitle></DialogHeader>
              <GroupForm onSubmit={(d) => createMutation.mutate(d)} isLoading={createMutation.isPending} />
            </DialogContent>
          </Dialog>
        }
      />

      {!isLoading && groups.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Layers}
            title="Noch keine Arten"
            description="Lege z.B. die Art „Kaffee“ an und ordne ihr danach deine Sorten zu. In Listen und Auswertungen werden sie dann zusammengefasst."
            actionLabel="Erste Art anlegen"
            onAction={() => setDialogOpen(true)}
          />
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Art</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="text-right">Sorten</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    <Link href={`/products?groupId=${g.id}`} className="text-rose-600 hover:underline">{g.name}</Link>
                  </TableCell>
                  <TableCell>{g.category?.name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{g.description || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={g._count?.products ? 'secondary' : 'outline'}>{g._count?.products ?? 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Dialog open={editing?.id === g.id} onOpenChange={(o) => !o && setEditing(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setEditing(g)}><Pencil className="h-4 w-4" /></Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Art bearbeiten</DialogTitle></DialogHeader>
                          {editing && <GroupForm defaultValues={editing} onSubmit={(d) => updateMutation.mutate({ ...editing, ...d })} isLoading={updateMutation.isPending} />}
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm('Löschen?')) deleteMutation.mutate(g.id) }}>
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
