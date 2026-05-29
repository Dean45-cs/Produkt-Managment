'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Produkte', icon: Package },
  { href: '/categories', label: 'Kategorien', icon: Tag },
  { href: '/inventory', label: 'Bestand', icon: Warehouse },
  { href: '/locations', label: 'Standorte', icon: MapPin },
  { href: '/suppliers', label: 'Lieferanten', icon: Users },
  { href: '/deliveries', label: 'Lieferungen', icon: Truck },
  { href: '/settlements', label: 'Abrechnungen', icon: PackageCheck },
  { href: '/purchase-orders', label: 'Einkauf', icon: ShoppingCart },
  { href: '/returns', label: 'Retouren', icon: RotateCcw },
  { href: '/stock-adjustments', label: 'Lagerbewegungen', icon: ArrowLeftRight },
  { href: '/analytics', label: 'Analyse', icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 min-h-screen bg-neutral-950 text-white flex flex-col flex-shrink-0 border-r border-neutral-800">
      <div className="p-4 border-b border-neutral-800">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="inline-block h-5 w-1.5 rounded-full bg-rose-600" />
          Produkt Manager
        </h1>
        <p className="text-xs text-neutral-500 mt-1 pl-3.5">Bestand &amp; Verkauf</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-dark">
        {navItems.map((item) => {
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
      </nav>
      <div className="p-4 border-t border-neutral-800">
        <p className="text-[10px] text-neutral-600">© {new Date().getFullYear()} Produkt Manager</p>
      </div>
    </aside>
  )
}
