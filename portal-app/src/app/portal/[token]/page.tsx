'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { centsToEuro } from '@/lib/money'
import { Store, Lock, Loader2, CheckCircle2, AlertTriangle, PackageOpen, Send } from 'lucide-react'

interface OpenDeliveryItem {
  productId: string
  productName: string | null
  quantityOpen: number
  suggestedPriceCt: number
}
interface OpenDelivery {
  deliveryId: string
  label: string | null
  deliveryDate: string | null
  items: OpenDeliveryItem[]
}
interface RecentSubmission {
  id: string
  deliveryLabel: string | null
  displayStatus: 'RECEIVED' | 'BOOKED' | 'FAILED'
  qty: number
  totalCt: number
  bookError: string | null
  createdAt: string
}
interface MeResponse {
  ok: boolean
  name?: string | null
  requiresPin?: boolean
  authed?: boolean
  deliveries?: OpenDelivery[]
  recentSubmissions?: RecentSubmission[]
}

type Draft = { qty: string; amount: string }

const STATUS_LABEL: Record<RecentSubmission['displayStatus'], string> = {
  RECEIVED: 'Eingereicht',
  BOOKED: 'Verbucht',
  FAILED: 'Problem',
}
const STATUS_VARIANT: Record<RecentSubmission['displayStatus'], 'info' | 'success' | 'destructive'> = {
  RECEIVED: 'info',
  BOOKED: 'success',
  FAILED: 'destructive',
}

export default function PortalPage() {
  const { token } = useParams<{ token: string }>()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSubmitting, setPinSubmitting] = useState(false)

  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [result, setResult] = useState<{ deliveryId: string; type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/portal/${token}/me`, { cache: 'no-store' })
      const data: MeResponse = await r.json().catch(() => ({ ok: false }))
      setMe(data)
    } catch {
      setMe({ ok: false })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setPinError(null)
    setPinSubmitting(true)
    try {
      const r = await fetch(`/api/portal/${token}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { setPinError(data.error || 'Anmeldung fehlgeschlagen'); return }
      setPin('')
      await load()
    } catch {
      setPinError('Netzwerkfehler')
    } finally {
      setPinSubmitting(false)
    }
  }

  function setDraft(key: string, field: keyof Draft, value: string) {
    setDrafts((d) => {
      const current: Draft = d[key] ?? { qty: '', amount: '' }
      return { ...d, [key]: { ...current, [field]: value } }
    })
  }

  async function submitDelivery(delivery: OpenDelivery) {
    setResult(null)
    const items = delivery.items
      .map((it) => {
        const key = `${delivery.deliveryId}:${it.productId}`
        const d = drafts[key]
        const qty = d ? parseInt(d.qty, 10) : 0
        const amount = d ? Number(d.amount) : 0
        return { productId: it.productId, quantitySold: qty, totalAmount: amount }
      })
      .filter((i) => Number.isFinite(i.quantitySold) && i.quantitySold > 0)

    if (items.length === 0) {
      setResult({ deliveryId: delivery.deliveryId, type: 'err', text: 'Bitte mindestens ein verkauftes Stück eintragen.' })
      return
    }

    setSubmittingId(delivery.deliveryId)
    try {
      const r = await fetch(`/api/portal/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryId: delivery.deliveryId,
          reportedAt: new Date().toISOString().split('T')[0],
          note: notes[delivery.deliveryId] || undefined,
          items,
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setResult({ deliveryId: delivery.deliveryId, type: 'err', text: data.error || 'Einreichen fehlgeschlagen' })
        return
      }
      setDrafts((d) => {
        const next = { ...d }
        for (const it of delivery.items) delete next[`${delivery.deliveryId}:${it.productId}`]
        return next
      })
      setNotes((n) => ({ ...n, [delivery.deliveryId]: '' }))
      setResult({ deliveryId: delivery.deliveryId, type: 'ok', text: 'Verkauf eingereicht. Danke!' })
      await load()
    } catch {
      setResult({ deliveryId: delivery.deliveryId, type: 'err', text: 'Netzwerkfehler' })
    } finally {
      setSubmittingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Lädt…
      </div>
    )
  }

  if (!me?.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
        <div className="w-full max-w-sm rounded-xl border bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-200">
            <Lock className="h-6 w-6 text-neutral-500" />
          </div>
          <h1 className="font-semibold text-neutral-900">Zugang nicht gültig</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dieser Link ist ungültig oder wurde deaktiviert. Bitte wende dich an deinen Ansprechpartner.
          </p>
        </div>
      </div>
    )
  }

  if (me.requiresPin && !me.authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 shadow-lg shadow-rose-900/30">
              <Store className="h-6 w-6 text-white" />
            </div>
            <h1 className="font-semibold text-neutral-900">Hallo{me.name ? `, ${me.name}` : ''}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Bitte gib deinen PIN ein, um deine Verkäufe einzureichen.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
            />
          </div>
          {pinError && <p className="mt-2 text-sm text-rose-600">{pinError}</p>}
          <Button type="submit" disabled={pinSubmitting || !pin} className="mt-4 w-full">
            {pinSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Anmelden…</> : <><Lock className="h-4 w-4" /> Anmelden</>}
          </Button>
        </form>
      </div>
    )
  }

  const deliveries = me.deliveries ?? []
  const recent = me.recentSubmissions ?? []

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="bg-neutral-950 text-white">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <div className="flex items-center gap-2">
            <span className="inline-block h-5 w-1.5 rounded-full bg-rose-600" />
            <h1 className="text-lg font-bold">Verkäufer-Portal</h1>
          </div>
          <p className="mt-1 pl-3.5 text-sm text-neutral-400">
            {me.name ? `Angemeldet als ${me.name}` : 'Deine Verkäufe einreichen'}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div>
          <h2 className="mb-1 text-base font-semibold text-neutral-900">Deine offene Ware</h2>
          <p className="text-sm text-muted-foreground">
            Trage ein, wie viele Stück du verkauft hast und den dafür erhaltenen Gesamtbetrag. Nicht verkaufte Stück
            bleiben offen und können später abgerechnet werden.
          </p>
        </div>

        {deliveries.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <PackageOpen className="mx-auto mb-3 h-8 w-8 text-neutral-400" />
            <p className="font-medium text-neutral-900">Aktuell keine offene Ware</p>
            <p className="mt-1 text-sm text-muted-foreground">Sobald du neue Ware bekommst, erscheint sie hier.</p>
          </div>
        ) : (
          deliveries.map((d) => {
            const isSubmitting = submittingId === d.deliveryId
            const res = result?.deliveryId === d.deliveryId ? result : null
            return (
              <section key={d.deliveryId} className="rounded-xl border bg-white shadow-sm">
                <div className="border-b px-4 py-3">
                  <p className="font-semibold text-neutral-900">{d.label || 'Ladung'}</p>
                  <p className="text-xs text-muted-foreground">{d.items.length} Produkt(e) offen</p>
                </div>
                <div className="space-y-4 p-4">
                  {d.items.map((it) => {
                    const key = `${d.deliveryId}:${it.productId}`
                    const draft = drafts[key] || { qty: '', amount: '' }
                    return (
                      <div key={it.productId} className="rounded-lg border bg-neutral-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="font-medium text-neutral-900">{it.productName || 'Produkt'}</p>
                          <Badge variant="info">{it.quantityOpen} offen</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Verkauft (Stück)</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max={it.quantityOpen}
                              value={draft.qty}
                              onChange={(e) => setDraft(key, 'qty', e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Betrag gesamt (€)</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              value={draft.amount}
                              onChange={(e) => setDraft(key, 'amount', e.target.value)}
                              placeholder="0,00"
                            />
                          </div>
                        </div>
                        {it.suggestedPriceCt > 0 && (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            Richtpreis: {centsToEuro(it.suggestedPriceCt)} / Stück
                          </p>
                        )}
                      </div>
                    )
                  })}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Notiz (optional)</Label>
                    <Input
                      value={notes[d.deliveryId] || ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [d.deliveryId]: e.target.value }))}
                      placeholder="z.B. Markt Musterstadt"
                    />
                  </div>

                  {res && (
                    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${res.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                      {res.type === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                      <span>{res.text}</span>
                    </div>
                  )}

                  <Button onClick={() => submitDelivery(d)} disabled={isSubmitting} className="w-full">
                    {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Senden…</> : <><Send className="h-4 w-4" /> Verkauf einreichen</>}
                  </Button>
                </div>
              </section>
            )
          })
        )}

        {recent.length > 0 && (
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <p className="font-semibold text-neutral-900">Zuletzt eingereicht</p>
            </div>
            <ul className="divide-y">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[s.displayStatus]}>{STATUS_LABEL[s.displayStatus]}</Badge>
                      <span className="text-sm text-neutral-900">{s.qty} Stück</span>
                    </div>
                    {s.displayStatus === 'FAILED' && s.bookError && (
                      <p className="mt-1 text-xs text-rose-600">{s.bookError}</p>
                    )}
                  </div>
                  <span className="font-semibold text-emerald-600">{centsToEuro(s.totalCt)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="pb-4 text-center text-[11px] text-neutral-500">Gesicherter Zugang · nur für dich bestimmt</p>
      </main>
    </div>
  )
}
