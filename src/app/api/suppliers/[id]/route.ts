export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'
import { hasAnyRole, NO_ROLE_ERROR, parseContactRoles, roleLabel } from '@/lib/contact'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supplier = await prisma.supplier.findUnique({ where: { id } })
  if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(supplier)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { name, contactName, email, phone, address, notes } = body
  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: 'Name darf nicht leer sein' }, { status: 400 })
  }

  const parsed = parseContactRoles(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // Rollen gegen den gespeicherten Stand prüfen: ein Teil-Update darf den
  // Kontakt nicht versehentlich rollenlos zurücklassen.
  const current = await prisma.supplier.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasAnyRole({ ...current, ...parsed.data })) {
    return NextResponse.json({ error: NO_ROLE_ERROR }, { status: 400 })
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: { name: name?.trim(), contactName, email, phone, address, notes, ...parsed.data },
    })
    return NextResponse.json(supplier)
  } catch (err) {
    return handlePrismaError(err)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Kontakt nicht löschen, solange noch Ladungen oder Bestellungen daran hängen.
  const [contact, delCount, poCount] = await Promise.all([
    prisma.supplier.findUnique({ where: { id } }),
    prisma.delivery.count({ where: { supplierId: id } }),
    prisma.purchaseOrder.count({ where: { supplierId: id } }),
  ])
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (delCount > 0 || poCount > 0) {
    const used = [
      delCount > 0 ? `${delCount} Ladung${delCount === 1 ? '' : 'en'}` : null,
      poCount > 0 ? `${poCount} Bestellung${poCount === 1 ? '' : 'en'}` : null,
    ].filter(Boolean)
    return NextResponse.json(
      { error: `${roleLabel(contact)} „${contact.name}“ wird noch verwendet: ${used.join(' und ')}` },
      { status: 409 }
    )
  }
  try {
    await prisma.supplier.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handlePrismaError(err)
  }
}
