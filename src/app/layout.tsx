import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { QueryProvider } from '@/components/providers/QueryProvider'

export const metadata: Metadata = {
  title: 'Produkt Manager',
  description: 'Bestand, Lieferungen und Abrechnungen verwalten',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased">
        <QueryProvider>
          <div className="flex min-h-screen bg-neutral-50">
            <Sidebar />
            <main className="flex-1 p-6 overflow-auto">{children}</main>
          </div>
        </QueryProvider>
      </body>
    </html>
  )
}
