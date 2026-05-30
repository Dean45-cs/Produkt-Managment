export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

export async function GET() {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(suppliers)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, contactName, email, phone, address, notes } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  try {
    const supplier = await prisma.supplier.create({ data: { name: name.trim(), contactName, email, phone, address, notes } })
    return NextResponse.json(supplier, { status: 201 })
  } catch (err) {
    return handlePrismaError(err)
  }
}
