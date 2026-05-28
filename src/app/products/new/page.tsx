'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProductForm } from '@/components/forms/ProductForm'

export default function NewProductPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      router.push('/products')
    },
  })

  return (
    <div>
      <PageHeader title="Neues Produkt" description="Produkt anlegen" />
      <ProductForm
        onSubmit={(data) => mutation.mutate(data)}
        isLoading={mutation.isPending}
      />
    </div>
  )
}
