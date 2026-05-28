import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [inventory, locations, products] = await Promise.all([
    prisma.inventory.findMany({
      include: {
        product: { include: { category: true } },
        location: true,
      },
    }),
    prisma.location.findMany({ orderBy: { name: 'asc' } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])

  return NextResponse.json({ inventory, locations, products })
}
