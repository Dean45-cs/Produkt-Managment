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
  { href: '/stock-adjustments', label: 'Korrekturen', icon: ArrowLeftRight },
  { href: '/analytics', label: 'Analyse', icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 min-h-screen bg-gray-900 text-white flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">Produkt Manager</h1>
        <p className="text-xs text-gray-400 mt-0.5">Bestand & Verkauf</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
