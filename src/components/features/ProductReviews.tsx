'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StarRating } from '@/components/ui/star-rating'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { Plus, Trash2, MessageSquare } from 'lucide-react'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'

interface Review {
  id: string
  rating: number
  comment?: string | null
  customerName?: string | null
  createdAt: string
}

function RatingForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const qc = useQueryClient()
  const [rating, setRating] = useState(5)
  const [customerName, setCustomerName] = useState('')
  const [comment, setComment] = useState('')

  const createMutation = useMutation({
    mutationFn: () => apiFetch('/api/reviews', jsonInit({ productId, rating, customerName, comment })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews', productId] })
      qc.invalidateQueries({ queryKey: ['product', productId] })
      onDone()
      toast('Bewertung gespeichert', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createMutation.mutate()
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label>Bewertung *</Label>
        <div className="flex items-center gap-3">
          <StarRating value={rating} interactive size={28} onChange={setRating} />
          <span className="text-sm text-muted-foreground">{rating} / 5</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rev-name">Kunde (optional)</Label>
        <Input id="rev-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="z.B. Anna M." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rev-comment">Kommentar (optional)</Label>
        <Textarea id="rev-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Was hat dem Kunden gefallen?" />
      </div>
      <Button type="submit" disabled={createMutation.isPending}>Bewertung speichern</Button>
    </form>
  )
}

export function ProductReviews({ productId }: { productId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ['reviews', productId],
    queryFn: () => fetch(`/api/reviews?productId=${productId}`).then((r) => r.json()),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/reviews/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews', productId] })
      qc.invalidateQueries({ queryKey: ['product', productId] })
      toast('Bewertung gelöscht', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const count = reviews.length
  const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0

  // Verteilung 5..1 Sterne
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => r.rating === star).length,
  }))

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-rose-600" /> Kundenbewertungen
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Bewertung</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neue Bewertung</DialogTitle></DialogHeader>
              <RatingForm productId={productId} onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Bewertungen. Füge die erste hinzu!</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-6 mb-6">
              {/* Durchschnitt */}
              <div className="flex flex-col items-center justify-center px-6 py-3 rounded-lg bg-amber-50 border border-amber-100">
                <span className="text-4xl font-bold text-amber-500">{avg.toFixed(1)}</span>
                <StarRating value={avg} size={18} />
                <span className="text-xs text-muted-foreground mt-1">{count} {count === 1 ? 'Bewertung' : 'Bewertungen'}</span>
              </div>

              {/* Verteilung */}
              <div className="flex-1 space-y-1.5 self-center">
                {distribution.map((d) => {
                  const pct = count > 0 ? (d.n / count) * 100 : 0
                  return (
                    <div key={d.star} className="flex items-center gap-2 text-sm">
                      <span className="w-10 text-right text-muted-foreground">{d.star} ★</span>
                      <div className="flex-1 h-2.5 rounded-full bg-neutral-100 overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-muted-foreground">{d.n}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Einzelne Bewertungen */}
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StarRating value={r.rating} size={14} />
                      <span className="text-sm font-medium">{r.customerName || 'Anonym'}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground break-words">{r.comment}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { if (confirm('Bewertung löschen?')) deleteMutation.mutate(r.id) }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
