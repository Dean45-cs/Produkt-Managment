'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'

/**
 * Hülle, die den Zugriff absichert:
 * - Auf /unlock: nur die Vollbild-Entsperrseite (keine Sidebar).
 * - Sonst: prüft /api/auth/status; gesperrt → Weiterleitung zu /unlock,
 *   entsperrt → normales App-Layout mit Sidebar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isUnlockPage = pathname === '/unlock'
  const [status, setStatus] = useState<'checking' | 'unlocked' | 'locked'>('checking')

  useEffect(() => {
    if (isUnlockPage) return
    let active = true

    const goLocked = () => {
      if (!active) return
      setStatus('locked')
      router.replace('/unlock')
    }

    const checkStatus = () =>
      fetch('/api/auth/status')
        .then((r) => r.json())
        .then((s) => {
          if (!active) return
          if (s.unlocked) setStatus('unlocked')
          else goLocked()
        })
        .catch(goLocked)

    checkStatus()

    // Heartbeat bei echter Nutzeraktivität, gedrosselt auf max. 1×/Minute.
    // Hält die serverseitige Auto-Sperre zurück, solange aktiv gearbeitet wird.
    let lastBeat = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - lastBeat < 60_000) return
      lastBeat = now
      fetch('/api/auth/touch', { method: 'POST' }).catch(() => {})
    }
    const events: (keyof DocumentEventMap)[] = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    // Regelmäßig prüfen, ob die App serverseitig (Inaktivität) gesperrt wurde.
    const poll = setInterval(checkStatus, 60_000)

    return () => {
      active = false
      clearInterval(poll)
      events.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [isUnlockPage, router])

  if (isUnlockPage) return <>{children}</>

  if (status !== 'unlocked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        Lädt…
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen bg-background">
      <div className="app-aura pointer-events-none fixed inset-0 -z-10" />
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
