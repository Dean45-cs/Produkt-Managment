import Link from 'next/link'
import type { ElementType } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface EmptyStateProps {
  icon: ElementType
  title: string
  description?: string
  /** Wenn gesetzt, wird ein Button angezeigt, der hierhin verlinkt */
  actionHref?: string
  /** Alternative zu actionHref: Button löst diese Funktion aus (z.B. Dialog öffnen) */
  onAction?: () => void
  actionLabel?: string
}

/**
 * Freundlicher Leerzustand mit Symbol, Erklärung und optionalem Call-to-Action.
 * Wird statt der grauen "Noch keine ..."-Zeile verwendet, damit der Nutzer
 * immer weiß, was der nächste Schritt ist.
 */
export function EmptyState({ icon: Icon, title, description, actionHref, onAction, actionLabel }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500 mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-semibold">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-4">
          <Button><Plus className="h-4 w-4" /> {actionLabel}</Button>
        </Link>
      )}
      {actionLabel && !actionHref && onAction && (
        <Button className="mt-4" onClick={onAction}><Plus className="h-4 w-4" /> {actionLabel}</Button>
      )}
    </div>
  )
}
