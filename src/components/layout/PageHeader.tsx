import React from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 animate-fade-up">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <span className="mt-2 block h-0.5 w-10 rounded-full bg-gradient-to-r from-rose-600 to-rose-600/0" />
        {description && <p className="text-muted-foreground mt-2 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
