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
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((s) => {
        if (!active) return
        if (s.unlocked) {
          setStatus('unlocked')
        } else {
          setStatus('locked')
          router.replace('/unlock')
        }
      })
      .catch(() => {
        if (!active) return
        setStatus('locked')
        router.replace('/unlock')
      })
    return () => {
      active = false
    }
  }, [isUnlockPage, router])

  if (isUnlockPage) return <>{children}</>

  if (status !== 'unlocked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-sm text-muted-foreground">
        Lädt…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
