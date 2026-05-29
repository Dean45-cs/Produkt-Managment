'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface Category {
  id: string
  name: string
  description?: string
  color?: string
}

function CategoryForm({ defaultValues, onSubmit, isLoading }: {
  defaultValues?: Partial<Category>
  onSubmit: (data: Partial<Category>) => void
  isLoading?: boolean
}) {
  const [name, setName] = useState(defaultValues?.name || '')
  const [description, setDescription] = useState(defaultValues?.description || '')
  const [color, setColor] = useState(defaultValues?.color || '#e11d48')

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, description, color }) }} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cat-name">Name *</Label>
        <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cat-desc">Beschreibung</Label>
        <Input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cat-color">Farbe</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 rounded border cursor-pointer" />
          <span className="text-sm text-muted-foreground">{color}</span>
        </div>
      </div>
      <Button type="submit" disabled={isLoading}>Speichern</Button>
    </form>
  )
}

export default function CategoriesPage() {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const qc = useQueryClient()

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => fetch('/api/categories').then((r) => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Category>) =>
      fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setDialogOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Category) =>
      fetch(`/api/categories/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditingCategory(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  return (
    <div>
      <PageHeader
        title="Kategorien"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Neue Kategorie</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neue Kategorie</DialogTitle></DialogHeader>
              <CategoryForm
                onSubmit={(data) => createMutation.mutate(data)}
                isLoading={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Farbe</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="h-5 w-5 rounded-full" style={{ backgroundColor: c.color || '#e5e7eb' }} />
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.description || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Dialog open={editingCategory?.id === c.id} onOpenChange={(o) => !o && setEditingCategory(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setEditingCategory(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Kategorie bearbeiten</DialogTitle></DialogHeader>
                          {editingCategory && (
                            <CategoryForm
                              defaultValues={editingCategory}
                              onSubmit={(data) => updateMutation.mutate({ ...editingCategory, ...data })}
                              isLoading={updateMutation.isPending}
                            />
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm('Löschen?')) deleteMutation.mutate(c.id) }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
