'use client'

import { useEffect, useState } from 'react'
import * as Toast from '@radix-ui/react-toast'
import type { ToastType } from '@/lib/toast'

interface ToastItem { id: number; message: string; type: ToastType }

const STYLES: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error:   'bg-red-600 text-white',
  info:    'bg-neutral-800 text-white',
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail
      const id = Date.now()
      setToasts((prev) => [...prev, { id, message, type }])
    }
    window.addEventListener('app-toast', handler)
    return () => window.removeEventListener('app-toast', handler)
  }, [])

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          open
          onOpenChange={(open) => {
            if (!open) setToasts((prev) => prev.filter((x) => x.id !== t.id))
          }}
          duration={t.type === 'error' ? 6000 : 3500}
          className={`rounded-lg px-4 py-3 shadow-lg text-sm font-medium flex items-center justify-between gap-4 ${STYLES[t.type]}`}
        >
          <Toast.Description>{t.message}</Toast.Description>
          <Toast.Close className="opacity-70 hover:opacity-100 text-lg leading-none">✕</Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)] outline-none" />
    </Toast.Provider>
  )
}
