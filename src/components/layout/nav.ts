import type { ElementType } from 'react'
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
  Coins,
} from 'lucide-react'

export type NavItem = { href: string; label: string; icon: ElementType }
export type NavGroup = { heading: string; items: NavItem[] }

/** Zentrale Navigationsstruktur – genutzt von Sidebar und Schnellsuche. */
export const navGroups: NavGroup[] = [
  {
    heading: '',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    heading: 'Verkauf',
    items: [
      { href: '/deliveries', label: 'Ladungen', icon: Truck },
      { href: '/settlements', label: 'Abrechnungen', icon: PackageCheck },
      { href: '/receivables', label: 'Offene Posten', icon: Coins },
      { href: '/returns', label: 'Retouren', icon: RotateCcw },
    ],
  },
  {
    heading: 'Einkauf',
    items: [{ href: '/purchase-orders', label: 'Bestellungen', icon: ShoppingCart }],
  },
  {
    heading: 'Stammdaten',
    items: [
      { href: '/products', label: 'Produkte', icon: Package },
      { href: '/categories', label: 'Kategorien', icon: Tag },
      { href: '/suppliers', label: 'Verkäufer', icon: Users },
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

/** Flache Liste aller navigierbaren Seiten (für die Suche). */
export const navItems: NavItem[] = navGroups.flatMap((g) => g.items)
