'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye, Smartphone } from 'lucide-react'

type Event = 'OPEN' | 'LOGIN_OK' | 'LOGIN_FAIL' | 'SUBMIT'

interface Entry {
  id: string
  event: Event
  ip: string | null
  userAgent: string | null
  createdAt: string
}
interface Response {
  configured: boolean
  entries: Entry[]
  error?: string
}

const EVENT_LABEL: Record<Event, string> = {
  OPEN: 'Portal geöffnet',
  LOGIN_OK: 'Angemeldet',
  LOGIN_FAIL: 'PIN falsch',
  SUBMIT: 'Verkauf eingereicht',
}
const EVENT_VARIANT: Record<Event, 'secondary' | 'success' | 'destructive' | 'info'> = {
  OPEN: 'secondary',
  LOGIN_OK: 'success',
  LOGIN_FAIL: 'destructive',
  SUBMIT: 'info',
}

/** Versucht aus dem User-Agent ein lesbares Gerät/Browser-Label zu machen. */
function deviceLabel(ua: string | null): string {
  if (!ua) return 'Unbekanntes Gerät'
  const os = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /Linux/.test(ua) ? 'Linux'
    : 'Gerät'
  const br = /Edg/.test(ua) ? 'Edge'
    : /CriOS|Chrome/.test(ua) ? 'Chrome'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari'
    : ''
  return br ? `${os} · ${br}` : os
}

export function SellerAccessLog({ supplierId }: { supplierId: string }) {
  const { data, isLoading } = useQuery<Response>({
    queryKey: ['seller-access-log', supplierId],
    queryFn: () => fetch(`/api/portal-admin/access-log?supplierId=${supplierId}`).then((r) => r.json()),
  })

  const entries = data?.entries ?? []

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-rose-500" /> Zugriffe aufs Portal
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Wann und von welchem Gerät dieser Verkäufer das Portal genutzt hat. Nur für dich sichtbar.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : data && !data.configured ? (
          <p className="text-sm text-muted-foreground">Portal-App nicht verbunden – sobald sie verbunden ist, erscheinen hier die Zugriffe.</p>
        ) : data?.error ? (
          <p className="text-sm text-rose-600">Konnte nicht laden: {data.error}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Zugriffe.</p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={EVENT_VARIANT[e.event]}>{EVENT_LABEL[e.event]}</Badge>
                    <span className="flex items-center gap-1 text-sm text-neutral-700">
                      <Smartphone className="h-3.5 w-3.5 text-neutral-400" /> {deviceLabel(e.userAgent)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString('de-DE')}{e.ip ? ` · IP ${e.ip}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
