import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Verkäufer-Portal',
  description: 'Verkäufe einreichen',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  )
}
