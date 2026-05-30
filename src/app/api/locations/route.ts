export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

export async function GET() {
  const locations = await prisma.location.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(locations)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, type, address, notes } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  try {
    const location = await prisma.location.create({ data: { name: name.trim(), type: type || 'WAREHOUSE', address, notes } })
    return NextResponse.json(location, { status: 201 })
  } catch (err) {
    return handlePrismaError(err)
  }
}
