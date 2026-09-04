import { SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select'

interface ProductOption {
  id: string
  name: string
  sku: string
  group?: { id: string; name: string } | null
}

/**
 * Produkt-Auswahl, nach Art gruppiert. Produkte ohne Art landen am Ende unter
 * "Ohne Art", damit nichts unsichtbar wird.
 */
export function ProductOptions({ products, withSku = false }: { products: ProductOption[]; withSku?: boolean }) {
  const byGroup = new Map<string, { name: string; items: ProductOption[] }>()
  for (const p of products) {
    const key = p.group?.id ?? '__none__'
    const bucket = byGroup.get(key) ?? { name: p.group?.name ?? 'Ohne Art', items: [] }
    bucket.items.push(p)
    byGroup.set(key, bucket)
  }

  const groups = Array.from(byGroup.entries()).sort(([a], [b]) => {
    if (a === '__none__') return 1
    if (b === '__none__') return -1
    return (byGroup.get(a)?.name ?? '').localeCompare(byGroup.get(b)?.name ?? '')
  })

  const label = (p: ProductOption) => (withSku ? `${p.name} (${p.sku})` : p.name)

  // Ohne angelegte Arten wäre eine Gruppenüberschrift nur Lärm.
  if (groups.length === 1) {
    return <>{products.map((p) => <SelectItem key={p.id} value={p.id}>{label(p)}</SelectItem>)}</>
  }

  return (
    <>
      {groups.map(([key, bucket]) => (
        <SelectGroup key={key}>
          <SelectLabel>{bucket.name}</SelectLabel>
          {bucket.items.map((p) => (
            <SelectItem key={p.id} value={p.id}>{label(p)}</SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  )
}
