import { Store } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600">
          <Store className="h-6 w-6 text-white" />
        </div>
        <h1 className="font-semibold text-neutral-900">Verkäufer-Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bitte öffne deinen persönlichen Link, um deine Verkäufe einzureichen.
        </p>
      </div>
    </div>
  )
}
