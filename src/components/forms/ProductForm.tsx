'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { centsToDecimal, euroToCents } from '@/lib/money'
import Link from 'next/link'
import { ImagePlus, Loader2, X } from 'lucide-react'

interface ProductFormData {
  name: string
  sku: string
  description: string
  categoryId: string
  groupId: string
  variantName: string
  unit: string
  purchasePrice: number
  minStockLevel: number
  reorderPoint: number
  reorderQty: number
}

interface Props {
  defaultValues?: Partial<ProductFormData & { purchasePriceCt: number; imageUrl: string | null }>
  onSubmit: (data: Record<string, unknown>) => void
  isLoading?: boolean
}

export function ProductForm({ defaultValues, onSubmit, isLoading }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(defaultValues?.imageUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: categories = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['categories'],
    queryFn: () => fetch('/api/categories').then((r) => r.json()),
  })

  const { data: groups = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['product-groups'],
    queryFn: () => fetch('/api/product-groups').then((r) => r.json()),
  })

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload fehlgeschlagen')
      setImageUrl(data.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  const { register, handleSubmit, setValue, watch } = useForm<ProductFormData>({
    defaultValues: {
      name: defaultValues?.name || '',
      sku: defaultValues?.sku || '',
      description: defaultValues?.description || '',
      categoryId: defaultValues?.categoryId || '',
      groupId: defaultValues?.groupId || '',
      variantName: defaultValues?.variantName || '',
      unit: defaultValues?.unit || 'Stück',
      purchasePrice: defaultValues?.purchasePriceCt ? centsToDecimal(defaultValues.purchasePriceCt) : 0,
      minStockLevel: defaultValues?.minStockLevel || 0,
      reorderPoint: defaultValues?.reorderPoint || 0,
      reorderQty: defaultValues?.reorderQty || 0,
    },
  })

  // Vorschlag für den Anzeigenamen aus Art und Sorte. Der Name bleibt frei
  // wählbar — vorgeschlagen wird nur, übernommen wird per Klick.
  const selectedGroup = groups.find((g) => g.id === watch('groupId'))
  const variant = watch('variantName')?.trim()
  const suggestedName = selectedGroup && variant ? `${selectedGroup.name} – ${variant}` : ''

  function handleFormSubmit(data: ProductFormData) {
    onSubmit({
      name: data.name,
      sku: data.sku,
      description: data.description,
      imageUrl,
      categoryId: data.categoryId || null,
      groupId: data.groupId || null,
      variantName: data.variantName || null,
      unit: data.unit,
      purchasePriceCt: euroToCents(data.purchasePrice),
      minStockLevel: Number(data.minStockLevel),
      reorderPoint: Number(data.reorderPoint),
      reorderQty: Number(data.reorderQty),
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Art</Label>
          <Select
            value={watch('groupId') || 'none'}
            onValueChange={(v) => setValue('groupId', v === 'none' ? '' : v)}
          >
            <SelectTrigger><SelectValue placeholder="Keine Art" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine Art</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Fasst mehrere Sorten zusammen — anlegen unter{' '}
            <Link href="/product-groups" className="text-rose-600 hover:underline">Arten</Link>.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="variantName">Sorte</Label>
          <Input id="variantName" {...register('variantName')} placeholder="z.B. Hausmischung" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" {...register('name', { required: true })} />
          {suggestedName && suggestedName !== watch('name') && (
            <button
              type="button"
              onClick={() => setValue('name', suggestedName)}
              className="text-xs text-rose-600 hover:underline"
            >
              „{suggestedName}“ übernehmen
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sku">SKU *</Label>
          <Input id="sku" {...register('sku', { required: true })} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Beschreibung</Label>
        <Textarea id="description" {...register('description')} rows={2} />
      </div>

      <div className="space-y-1.5">
        <Label>Produktbild</Label>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-md border bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Vorschau" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-6 w-6 text-gray-300" />
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border cursor-pointer hover:bg-accent">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? 'Lädt...' : imageUrl ? 'Ändern' : 'Bild hochladen'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={uploading} />
              </label>
              {imageUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl(null)} className="text-destructive">
                  <X className="h-4 w-4" /> Entfernen
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP oder GIF · max. 5 MB</p>
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Kategorie</Label>
          <Select
            value={watch('categoryId')}
            onValueChange={(v) => setValue('categoryId', v === 'none' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Keine Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine Kategorie</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">Einheit</Label>
          <Input id="unit" {...register('unit')} placeholder="Stück, kg, L..." />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="purchasePrice">Einkaufspreis (€)</Label>
        <Input id="purchasePrice" type="number" step="0.01" min="0" {...register('purchasePrice')} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="minStockLevel">Mindestbestand</Label>
          <Input id="minStockLevel" type="number" min="0" {...register('minStockLevel')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reorderPoint">Nachbestellpunkt</Label>
          <Input id="reorderPoint" type="number" min="0" {...register('reorderPoint')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reorderQty">Nachbestellmenge</Label>
          <Input id="reorderQty" type="number" min="0" {...register('reorderQty')} />
        </div>
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Speichern...' : 'Speichern'}
      </Button>
    </form>
  )
}
