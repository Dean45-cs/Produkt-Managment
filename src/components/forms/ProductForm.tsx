'use client'

import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { centsToDecimal, euroToCents } from '@/lib/money'

interface ProductFormData {
  name: string
  sku: string
  description: string
  categoryId: string
  unit: string
  purchasePrice: number
  minStockLevel: number
  reorderPoint: number
  reorderQty: number
}

interface Props {
  defaultValues?: Partial<ProductFormData & { purchasePriceCt: number }>
  onSubmit: (data: Record<string, unknown>) => void
  isLoading?: boolean
}

export function ProductForm({ defaultValues, onSubmit, isLoading }: Props) {
  const { data: categories = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['categories'],
    queryFn: () => fetch('/api/categories').then((r) => r.json()),
  })

  const { register, handleSubmit, setValue, watch } = useForm<ProductFormData>({
    defaultValues: {
      name: defaultValues?.name || '',
      sku: defaultValues?.sku || '',
      description: defaultValues?.description || '',
      categoryId: defaultValues?.categoryId || '',
      unit: defaultValues?.unit || 'Stück',
      purchasePrice: defaultValues?.purchasePriceCt ? centsToDecimal(defaultValues.purchasePriceCt) : 0,
      minStockLevel: defaultValues?.minStockLevel || 0,
      reorderPoint: defaultValues?.reorderPoint || 0,
      reorderQty: defaultValues?.reorderQty || 0,
    },
  })

  function handleFormSubmit(data: ProductFormData) {
    onSubmit({
      name: data.name,
      sku: data.sku,
      description: data.description,
      categoryId: data.categoryId || null,
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
          <Label htmlFor="name">Name *</Label>
          <Input id="name" {...register('name', { required: true })} />
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
