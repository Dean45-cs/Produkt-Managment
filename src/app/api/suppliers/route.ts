export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'
import { hasAnyRole, NO_ROLE_ERROR, parseContactRoles, roleFilter } from '@/lib/contact'

/** `?role=seller` bzw. `?role=wholesaler` schränkt auf eine Rolle ein. */
export async function GET(req: Request) {
  const role = new URL(req.url).searchParams.get('role')
  const suppliers = await prisma.supplier.findMany({
    where: roleFilter(role),
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(suppliers)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, contactName, email, phone, address, notes } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const parsed = parseContactRoles(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // Ohne Angabe ist ein neuer Kontakt ein Verkäufer – das ist der häufigste Fall.
  const roles = { isSeller: true, isWholesaler: false, ...parsed.data }
  if (!hasAnyRole(roles)) return NextResponse.json({ error: NO_ROLE_ERROR }, { status: 400 })

  try {
    const supplier = await prisma.supplier.create({
      data: { name: name.trim(), contactName, email, phone, address, notes, ...roles },
    })
    return NextResponse.json(supplier, { status: 201 })
  } catch (err) {
    return handlePrismaError(err)
  }
}
