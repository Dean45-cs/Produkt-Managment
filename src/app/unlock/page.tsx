'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react'

export default function UnlockPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [firstRun, setFirstRun] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((s) => {
        if (s.unlocked) {
          router.replace('/dashboard')
          return
        }
        setFirstRun(s.firstRun)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (firstRun && password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Entsperren fehlgeschlagen')
        setSubmitting(false)
        return
      }
      router.replace('/dashboard')
    } catch {
      setError('Netzwerkfehler')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-900/40 mb-4">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Produkt Manager</h1>
          <p className="text-sm text-neutral-400 mt-1">
            {loading ? 'Prüfe Status…' : firstRun ? 'Master-Passwort festlegen' : 'Mit Master-Passwort entsperren'}
          </p>
        </div>

        {!loading && (
          <form
            onSubmit={handleSubmit}
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4"
          >
            {firstRun && (
              <div className="flex gap-2 rounded-lg bg-amber-950/40 border border-amber-900/50 p-3 text-xs text-amber-200">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Dieses Passwort verschlüsselt deine gesamte Datenbank. Es wird <strong>nirgends gespeichert</strong>.
                  Vergisst du es, sind die Daten <strong>unwiederbringlich verloren</strong>.
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pw" className="text-neutral-300">Master-Passwort</Label>
              <Input
                id="pw"
                type="password"
                autoFocus
                autoComplete={firstRun ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                placeholder="••••••••"
              />
            </div>

            {firstRun && (
              <div className="space-y-1.5">
                <Label htmlFor="pw2" className="text-neutral-300">Passwort bestätigen</Label>
                <Input
                  id="pw2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <Button type="submit" disabled={submitting || !password} className="w-full">
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {firstRun ? 'Wird eingerichtet…' : 'Entsperren…'}</>
              ) : (
                <><ShieldCheck className="h-4 w-4" /> {firstRun ? 'Datenbank verschlüsseln & starten' : 'Entsperren'}</>
              )}
            </Button>
          </form>
        )}

        <p className="text-center text-[11px] text-neutral-600 mt-6">
          AES-256-verschlüsselt · Passwort wird nicht gespeichert
        </p>
      </div>
    </div>
  )
}
