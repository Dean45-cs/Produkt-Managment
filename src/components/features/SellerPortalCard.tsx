'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { apiFetch, jsonInit } from '@/lib/api'
import { toast } from '@/lib/toast'
import { Link2, Copy, Check, KeyRound, RefreshCw, Power, ShieldAlert, ShieldCheck } from 'lucide-react'

interface PortalConfig {
  supplierId: string
  name: string
  enabled: boolean
  token: string | null
  hasPin: boolean
}

/**
 * Verwaltung des Verkäufer-Portal-Zugangs (Owner-Sicht). Aktivieren erzeugt
 * einen persönlichen Geheim-Link; zusätzlich kann ein PIN gesetzt werden.
 */
export function SellerPortalCard({ supplierId }: { supplierId: string }) {
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [pinValue, setPinValue] = useState('')
  const [editingPin, setEditingPin] = useState(false)

  const { data, isLoading } = useQuery<PortalConfig>({
    queryKey: ['seller-portal', supplierId],
    queryFn: () => fetch(`/api/portal-admin/sellers/${supplierId}`).then((r) => r.json()),
  })

  const act = useMutation({
    mutationFn: (body: { action: string; pin?: string }) =>
      apiFetch(`/api/portal-admin/sellers/${supplierId}`, jsonInit(body)).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller-portal', supplierId] }),
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const run = (body: { action: string; pin?: string }, successMsg?: string, after?: () => void) =>
    act.mutate(body, { onSuccess: () => { if (successMsg) toast(successMsg, 'success'); after?.() } })

  const link = data?.token && typeof window !== 'undefined' ? `${window.location.origin}/portal/${data.token}` : ''

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast('Kopieren nicht möglich', 'error')
    }
  }

  function savePin() {
    if (!/^\d{4,8}$/.test(pinValue)) {
      toast('PIN muss 4–8 Ziffern haben', 'error')
      return
    }
    run({ action: 'setPin', pin: pinValue }, 'PIN gespeichert', () => { setPinValue(''); setEditingPin(false) })
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-rose-500" /> Verkäufer-Portal
          {data?.enabled && <Badge variant="success">Aktiv</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Gib dem Verkäufer einen persönlichen Link, über den er seine Verkäufe selbst einreicht. Eingereichte
          Verkäufe werden automatisch als Abrechnung verbucht.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : !data?.enabled ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Portal-Zugang ist für diesen Verkäufer noch nicht aktiv.</p>
            <Button onClick={() => run({ action: 'enable' }, 'Portal aktiviert')} disabled={act.isPending}>
              <Power className="h-4 w-4" /> Portal aktivieren
            </Button>
          </div>
        ) : (
          <>
            {/* Link */}
            <div className="space-y-1.5">
              <Label>Persönlicher Link</Label>
              <div className="flex gap-2">
                <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                <Button variant="outline" onClick={copyLink} className="flex-shrink-0">
                  {copied ? <><Check className="h-4 w-4" /> Kopiert</> : <><Copy className="h-4 w-4" /> Kopieren</>}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Diesen Link an den Verkäufer schicken (z.B. per WhatsApp oder E-Mail).</p>
            </div>

            {/* PIN */}
            <div className="rounded-lg border bg-neutral-50 p-3">
              {data.hasPin ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <ShieldCheck className="h-4 w-4" /> PIN ist gesetzt
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <ShieldAlert className="h-4 w-4" /> Kein PIN gesetzt – jeder mit dem Link kann einreichen.
                </div>
              )}

              {editingPin ? (
                <div className="mt-3 flex items-end gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Neuer PIN (4–8 Ziffern)</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={pinValue}
                      onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="z.B. 1234"
                      className="w-40"
                    />
                  </div>
                  <Button onClick={savePin} disabled={act.isPending}><KeyRound className="h-4 w-4" /> Speichern</Button>
                  <Button variant="ghost" onClick={() => { setEditingPin(false); setPinValue('') }}>Abbrechen</Button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingPin(true)}>
                    <KeyRound className="h-4 w-4" /> {data.hasPin ? 'PIN ändern' : 'PIN setzen'}
                  </Button>
                  {data.hasPin && (
                    <Button variant="ghost" size="sm" onClick={() => run({ action: 'clearPin' }, 'PIN entfernt')}>
                      PIN entfernen
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Verwaltung */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { if (confirm('Neuen Link erzeugen? Der alte Link wird damit ungültig.')) run({ action: 'regenerate' }, 'Neuer Link erzeugt') }}
              >
                <RefreshCw className="h-4 w-4" /> Neuen Link erzeugen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { if (confirm('Portal-Zugang deaktivieren? Der Verkäufer kann dann nichts mehr einreichen.')) run({ action: 'disable' }, 'Portal deaktiviert') }}
              >
                <Power className="h-4 w-4" /> Deaktivieren
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
