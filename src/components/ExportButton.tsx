import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface Props {
  href: string
  label?: string
  className?: string
}

/** CSV-Download-Button (rendert als <a download>, damit der Browser den Download auslöst). */
export function ExportButton({ href, label = 'CSV-Export', className }: Props) {
  return (
    <a href={href} download className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), className)}>
      <Download className="h-4 w-4" /> {label}
    </a>
  )
}
