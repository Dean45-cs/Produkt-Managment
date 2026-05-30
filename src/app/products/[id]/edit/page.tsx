'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProductForm } from '@/components/forms/ProductForm'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetch(`/api/products/${id}`).then((r) => r.json()),
  })

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiFetch(`/api/products/${id}`, jsonInit(data, 'PUT'))
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', id] })
      qc.invalidateQueries({ queryKey: ['products'] })
      router.push(`/products/${id}`)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  if (isLoading) return <div className="p-4 text-muted-foreground">Laden...</div>

  return (
    <div>
      <PageHeader title="Produkt bearbeiten" description={product?.name} />
      <ProductForm
        defaultValues={product}
        onSubmit={(data) => mutation.mutate(data)}
        isLoading={mutation.isPending}
      />
    </div>
  )
}
