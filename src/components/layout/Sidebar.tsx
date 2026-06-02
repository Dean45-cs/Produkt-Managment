'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Lock, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navGroups } from './nav'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLock() {
    await fetch('/api/auth/lock', { method: 'POST' }).catch(() => {})
    router.replace('/unlock')
  }

  return (
    <aside className="w-60 min-h-screen bg-gradient-to-b from-neutral-950 to-black text-white flex flex-col flex-shrink-0 border-r border-neutral-800/80">
      <div className="p-4 border-b border-neutral-800/80">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="inline-block h-5 w-1.5 rounded-full bg-rose-600 animate-glow" />
          Produkt Manager
        </h1>
        <p className="text-xs text-neutral-500 mt-1 pl-3.5">Bestand &amp; Verkauf</p>
      </div>
      <div className="px-2 pt-2">
        <button
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          className="group flex w-full items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-400 hover:border-rose-600/40 hover:text-white transition-colors"
        >
          <Search className="h-4 w-4 text-neutral-500 group-hover:text-rose-500" />
          <span className="flex-1 text-left">Suchen…</span>
          <kbd className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-500">⌘K</kbd>
        </button>
      </div>
      <nav className="flex-1 p-2 overflow-y-auto scrollbar-dark space-y-4">
        {navGroups.map((group) => (
          <div key={group.heading}>
            {group.heading && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
                {group.heading}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200',
                      isActive
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/60 before:absolute before:content-[""] before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-white/90'
                        : 'text-neutral-400 hover:bg-neutral-800/80 hover:text-white hover:translate-x-0.5'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-white' : 'text-neutral-500 group-hover:text-rose-500')} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-2 border-t border-neutral-800">
        <button
          onClick={handleLock}
          className="group flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <Lock className="h-4 w-4 flex-shrink-0 text-neutral-500 group-hover:text-rose-500" />
          Sperren
        </button>
        <p className="text-[10px] text-neutral-600 px-3 pt-2">© {new Date().getFullYear()} Produkt Manager</p>
      </div>
    </aside>
  )
}
