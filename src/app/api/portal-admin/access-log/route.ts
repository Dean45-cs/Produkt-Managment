export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSellerBySupplierId } from '@/lib/portal/store'
import { isSyncConfigured, fetchAccessLog } from '@/lib/portal/remote'

/** Zugriffs-Protokoll aus der Portal-App holen (Owner-Sicht, optional je Verkäufer). */
export async function GET(req: Request) {
  if (!isSyncConfigured()) return NextResponse.json({ configured: false, entries: [] })
  const url = new URL(req.url)
  const supplierId = url.searchParams.get('supplierId') || undefined
  try {
    const raw = await fetchAccessLog({ supplierRef: supplierId, limit: 200 })
    const nameCache = new Map<string, string | null>()
    const entries = raw.map((e) => {
      const ref = e.supplierRef
      if (ref && !nameCache.has(ref)) nameCache.set(ref, getSellerBySupplierId(ref)?.name ?? null)
      return { ...e, sellerName: ref ? nameCache.get(ref) ?? null : null }
    })
    return NextResponse.json({ configured: true, entries })
  } catch (e) {
    return NextResponse.json({ configured: true, entries: [], error: (e as Error)?.message })
  }
}
