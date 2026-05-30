'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProductForm } from '@/components/forms/ProductForm'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'

export default function NewProductPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiFetch('/api/products', jsonInit(data))
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      router.push('/products')
    },
    onError: (err: Error) => toast(err.message, 'error'),
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
