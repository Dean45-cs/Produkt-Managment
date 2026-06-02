'use client'

import { useEffect, useMemo, useRef, useState, type ElementType } from 'react'
import { useRouter } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import {
  Search, CornerDownLeft, Plus, Truck, ShoppingCart, Package, RotateCcw,
  Lock, Users, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { navItems } from './nav'

type Cmd = {
  id: string
  group: 'Aktionen' | 'Seiten' | 'Produkte' | 'Verkäufer'
  label: string
  sub?: string
  icon: ElementType
  keywords?: string
  run: () => void
}

const GROUP_ORDER: Cmd['group'][] = ['Aktionen', 'Seiten', 'Produkte', 'Verkäufer']

interface ProductLite { id: string; name: string; sku: string }
interface SupplierLite { id: string; name: string; contactName?: string | null }

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // ⌘K / Strg+K öffnet, außerdem ein Event für den Sidebar-Button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-command-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-command-palette', onOpen)
    }
  }, [])

  // Beim Schließen Suchfeld zurücksetzen.
  useEffect(() => {
    if (!open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  // Daten nur laden, wenn die Palette offen ist.
  const { data: products = [] } = useQuery<ProductLite[]>({
    queryKey: ['palette-products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()),
    enabled: open,
    staleTime: 60_000,
  })
  const { data: suppliers = [] } = useQuery<SupplierLite[]>({
    queryKey: ['palette-suppliers'],
    queryFn: () => fetch('/api/suppliers').then((r) => r.json()),
    enabled: open,
    staleTime: 60_000,
  })

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }
  const lock = async () => {
    setOpen(false)
    await fetch('/api/auth/lock', { method: 'POST' }).catch(() => {})
    router.replace('/unlock')
  }

  const allCommands = useMemo<Cmd[]>(() => {
    const actions: Cmd[] = [
      { id: 'a-delivery', group: 'Aktionen', label: 'Neue Ladung an Verkäufer', icon: Truck, keywords: 'ladung liefern verkäufer', run: () => go('/deliveries/new') },
      { id: 'a-po', group: 'Aktionen', label: 'Neue Bestellung beim Großhändler', icon: ShoppingCart, keywords: 'einkauf bestellen wareneingang', run: () => go('/purchase-orders/new') },
      { id: 'a-product', group: 'Aktionen', label: 'Neues Produkt anlegen', icon: Package, keywords: 'artikel produkt', run: () => go('/products/new') },
      { id: 'a-return', group: 'Aktionen', label: 'Neue Retoure erfassen', icon: RotateCcw, keywords: 'retoure rückgabe', run: () => go('/returns/new') },
      { id: 'a-lock', group: 'Aktionen', label: 'App sperren', icon: Lock, keywords: 'sperren logout abmelden', run: lock },
    ]
    const pages: Cmd[] = navItems.map((n) => ({
      id: `p-${n.href}`, group: 'Seiten', label: n.label, icon: n.icon, run: () => go(n.href),
    }))
    const prods: Cmd[] = products.map((p) => ({
      id: `prod-${p.id}`, group: 'Produkte', label: p.name, sub: p.sku, icon: Package,
      keywords: p.sku, run: () => go(`/products/${p.id}`),
    }))
    const sups: Cmd[] = suppliers.map((s) => ({
      id: `sup-${s.id}`, group: 'Verkäufer', label: s.name, sub: s.contactName || undefined, icon: Users,
      keywords: s.contactName || '', run: () => go(`/suppliers/${s.id}`),
    }))
    return [...actions, ...pages, ...prods, ...sups]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, suppliers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // Ohne Eingabe: nur Aktionen + Seiten zeigen (nicht alle Produkte dumpen).
      return allCommands.filter((c) => c.group === 'Aktionen' || c.group === 'Seiten')
    }
    const match = (c: Cmd) => (c.label + ' ' + (c.keywords || '')).toLowerCase().includes(q)
    const perGroup: Record<string, number> = {}
    return allCommands.filter((c) => {
      if (!match(c)) return false
      perGroup[c.group] = (perGroup[c.group] || 0) + 1
      return perGroup[c.group] <= 6 // pro Gruppe begrenzen
    })
  }, [query, allCommands])

  // Aktiven Index zurücksetzen, wenn sich die Treffer ändern.
  useEffect(() => {
    setActive(0)
  }, [query, filtered.length])

  // Aktives Element in den sichtbaren Bereich scrollen.
  useEffect(() => {
    itemRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      filtered[active]?.run()
    }
  }

  // Für die Tastatur-Navigation einen laufenden Index über alle Gruppen halten.
  let runningIndex = -1

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-rose-500/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onOpenAutoFocus={(e) => {
            // Fokus selbst auf das Suchfeld setzen.
            e.preventDefault()
          }}
        >
          <DialogPrimitive.Title className="sr-only">Schnellsuche</DialogPrimitive.Title>

          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Suchen oder Aktion wählen…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto scrollbar-dark p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Keine Treffer für „{query}"</p>
            ) : (
              GROUP_ORDER.map((group) => {
                const items = filtered.filter((c) => c.group === group)
                if (items.length === 0) return null
                return (
                  <div key={group} className="mb-1">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{group}</p>
                    {items.map((c) => {
                      runningIndex += 1
                      const idx = runningIndex
                      const isActive = idx === active
                      const Icon = c.icon
                      return (
                        <button
                          key={c.id}
                          ref={(el) => { itemRefs.current[idx] = el }}
                          onMouseMove={() => setActive(idx)}
                          onClick={() => c.run()}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                            isActive ? 'bg-rose-600/20 text-foreground ring-1 ring-rose-500/30' : 'text-muted-foreground hover:bg-muted/60'
                          )}
                        >
                          <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-rose-400' : 'text-muted-foreground')} />
                          <span className="flex-1 truncate text-foreground">{c.label}</span>
                          {c.sub && <span className="truncate text-xs text-muted-foreground">{c.sub}</span>}
                          {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-rose-400" />}
                          {!isActive && c.group === 'Seiten' && <ArrowRight className="h-3.5 w-3.5 opacity-0" />}
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Schnellaktionen &amp; Suche</span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1">↑</kbd><kbd className="rounded border border-border px-1">↓</kbd> Navigieren</span>
              <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1">↵</kbd> Öffnen</span>
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
