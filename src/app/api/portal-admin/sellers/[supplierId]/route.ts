export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getSellerBySupplierId,
  ensureSeller,
  enableSeller,
  disableSeller,
  regenerateToken,
  setPin,
  clearPin,
} from '@/lib/portal/store'
import { hashPin } from '@/lib/portal/auth'
import { syncSeller } from '@/lib/portal/sync'

function config(supplierId: string, name: string) {
  const seller = getSellerBySupplierId(supplierId)
  return {
    supplierId,
    name,
    enabled: seller?.enabled ?? false,
    token: seller?.token ?? null,
    hasPin: !!seller?.pinHash,
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } })
  if (!supplier) return NextResponse.json({ error: 'Verkäufer nicht gefunden' }, { status: 404 })
  return NextResponse.json(config(supplierId, supplier.name))
}

export async function POST(req: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } })
  if (!supplier) return NextResponse.json({ error: 'Verkäufer nicht gefunden' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const action: string = body?.action

  // Zeile sicherstellen (Name aktuell halten), ohne Aktivierung zu verändern.
  ensureSeller(supplierId, supplier.name)

  switch (action) {
    case 'enable':
      enableSeller(supplierId, supplier.name)
      await syncSeller(prisma, supplierId)
      break
    case 'disable':
      disableSeller(supplierId)
      break
    case 'regenerate':
      regenerateToken(supplierId)
      break
    case 'setPin': {
      const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''
      if (!/^\d{4,8}$/.test(pin)) {
        return NextResponse.json({ error: 'PIN muss 4–8 Ziffern haben' }, { status: 400 })
      }
      setPin(supplierId, hashPin(pin))
      break
    }
    case 'clearPin':
      clearPin(supplierId)
      break
    default:
      return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  }

  return NextResponse.json(config(supplierId, supplier.name))
}
