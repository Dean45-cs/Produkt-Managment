export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlePrismaError } from '@/lib/api-errors'

export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, description, color } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  try {
    const category = await prisma.category.create({ data: { name: name.trim(), description, color } })
    return NextResponse.json(category, { status: 201 })
  } catch (err) {
    return handlePrismaError(err)
  }
}
