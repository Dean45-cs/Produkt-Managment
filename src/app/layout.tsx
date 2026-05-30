import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/layout/AppShell'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Toaster } from '@/components/ui/Toaster'

export const metadata: Metadata = {
  title: 'Produkt Manager',
  description: 'Bestand, Lieferungen und Abrechnungen verwalten',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased">
        <QueryProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}
