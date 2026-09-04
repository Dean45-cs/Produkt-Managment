'use client'

import type { ElementType } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  MapPin,
  Tag,
  Truck,
  PackageCheck,
  ArrowLeftRight,
  ShoppingCart,
  BarChart3,
  RotateCcw,
  Users,
  Layers,
  Coins,
  Inbox,
  Wallet,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavGroup = {
  heading: string
  items: { href: string; label: string; icon: ElementType }[]
}

const navGroups: NavGroup[] = [
  {
    heading: '',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    heading: 'Verkauf',
    items: [
      { href: '/deliveries', label: 'Ladungen', icon: Truck },
      { href: '/settlements', label: 'Abrechnungen', icon: PackageCheck },
      { href: '/einreichungen', label: 'Portal-Eingang', icon: Inbox },
      { href: '/receivables', label: 'Offene Posten', icon: Coins },
      { href: '/returns', label: 'Retouren', icon: RotateCcw },
    ],
  },
  {
    heading: 'Geld',
    items: [
      { href: '/accounts', label: 'Kasse & Bank', icon: Wallet },
    ],
  },
  {
    heading: 'Einkauf',
    items: [
      { href: '/purchase-orders', label: 'Bestellungen', icon: ShoppingCart },
    ],
  },
  {
    heading: 'Stammdaten',
    items: [
      { href: '/products', label: 'Produkte', icon: Package },
      { href: '/categories', label: 'Kategorien', icon: Tag },
      { href: '/product-groups', label: 'Arten', icon: Layers },
      { href: '/suppliers', label: 'Verkäufer & Lieferanten', icon: Users },
      { href: '/inventory', label: 'Bestand', icon: Warehouse },
      { href: '/locations', label: 'Standorte', icon: MapPin },
    ],
  },
  {
    heading: 'Berichte',
    items: [
      { href: '/stock-adjustments', label: 'Lagerbewegungen', icon: ArrowLeftRight },
      { href: '/analytics', label: 'Analyse', icon: BarChart3 },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLock() {
    await fetch('/api/auth/lock', { method: 'POST' }).catch(() => {})
    router.replace('/unlock')
  }

  return (
    <aside className="w-60 min-h-screen bg-neutral-950 text-white flex flex-col flex-shrink-0 border-r border-neutral-800">
      <div className="p-4 border-b border-neutral-800">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="inline-block h-5 w-1.5 rounded-full bg-rose-600" />
          Produkt Manager
        </h1>
        <p className="text-xs text-neutral-500 mt-1 pl-3.5">Bestand &amp; Verkauf</p>
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
                      'group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/50'
                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
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
