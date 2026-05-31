/**
 * Logik für den Verkaufsfortschritt einer Ladung an einen Verkäufer.
 *
 * Ablauf: Du übergibst einem deiner Verkäufer eine Ladung Ware → beim Status
 * "Übergeben" verlässt die Ware dein Zentrallager (Bestand sinkt). Der Verkäufer
 * verkauft sie face2face und rechnet danach ab (ggf. in mehreren Schritten).
 * Die noch offene (= beim Verkäufer befindliche) Menge je Produkt =
 * übergeben − bereits abgerechnet − retourniert.
 */

export const DELIVERY_STATUS = {
  PENDING: 'PENDING',
  DELIVERED: 'DELIVERED',
  PARTIALLY_SETTLED: 'PARTIALLY_SETTLED',
  SETTLED: 'SETTLED',
  CANCELLED: 'CANCELLED',
} as const

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Geplant',
  DELIVERED: 'Beim Verkäufer',
  PARTIALLY_SETTLED: 'Teilw. abgerechnet',
  SETTLED: 'Abgerechnet',
  CANCELLED: 'Storniert',
}

export const DELIVERY_STATUS_VARIANTS: Record<string, 'default' | 'warning' | 'success' | 'destructive' | 'secondary' | 'info'> = {
  PENDING: 'secondary',
  DELIVERED: 'warning',
  PARTIALLY_SETTLED: 'info',
  SETTLED: 'success',
  CANCELLED: 'destructive',
}

export interface ProgressInput {
  items: { productId: string; quantitySent: number; product?: { name?: string | null } | null }[]
  settlements?: { items: { productId: string; quantitySold: number; totalAmountCt: number }[] }[]
  returns?: { items: { productId: string; quantityReturned: number }[] }[]
}

export interface ProductProgress {
  productId: string
  productName: string
  quantitySent: number
  quantitySettled: number
  quantityReturned: number
  quantityOpen: number
  amountSettledCt: number
}

export interface DeliveryProgress {
  perProduct: ProductProgress[]
  totalSent: number
  totalSettled: number
  totalReturned: number
  totalOpen: number
  amountSettledCt: number
  isFullySettled: boolean
}

/** Berechnet je Produkt, wie viel geliefert, abgerechnet, retourniert und noch offen ist. */
export function deliveryProgress(input: ProgressInput): DeliveryProgress {
  const map = new Map<string, ProductProgress>()

  for (const it of input.items) {
    const existing = map.get(it.productId)
    if (existing) {
      existing.quantitySent += it.quantitySent
    } else {
      map.set(it.productId, {
        productId: it.productId,
        productName: it.product?.name ?? '',
        quantitySent: it.quantitySent,
        quantitySettled: 0,
        quantityReturned: 0,
        quantityOpen: it.quantitySent,
        amountSettledCt: 0,
      })
    }
  }

  for (const s of input.settlements ?? []) {
    for (const si of s.items) {
      const p = map.get(si.productId)
      if (!p) continue
      p.quantitySettled += si.quantitySold
      p.amountSettledCt += si.totalAmountCt
    }
  }

  for (const r of input.returns ?? []) {
    for (const ri of r.items) {
      const p = map.get(ri.productId)
      if (!p) continue
      p.quantityReturned += ri.quantityReturned
    }
  }

  const perProduct = Array.from(map.values())
  for (const p of perProduct) {
    p.quantityOpen = Math.max(0, p.quantitySent - p.quantitySettled - p.quantityReturned)
  }

  const totalSent = perProduct.reduce((s, p) => s + p.quantitySent, 0)
  const totalSettled = perProduct.reduce((s, p) => s + p.quantitySettled, 0)
  const totalReturned = perProduct.reduce((s, p) => s + p.quantityReturned, 0)
  const totalOpen = perProduct.reduce((s, p) => s + p.quantityOpen, 0)
  const amountSettledCt = perProduct.reduce((s, p) => s + p.amountSettledCt, 0)

  return { perProduct, totalSent, totalSettled, totalReturned, totalOpen, amountSettledCt, isFullySettled: totalOpen === 0 }
}

/**
 * Ermittelt den Folgestatus einer (gelieferten) Lieferung nach einer Buchung.
 * - alles abgerechnet/retourniert → SETTLED
 * - mind. eine Abrechnung, aber noch offen → PARTIALLY_SETTLED
 * - sonst unverändert (z.B. DELIVERED bleibt DELIVERED)
 */
export function nextDeliveryStatus(current: string, totalOpen: number, hasSettlements: boolean): string {
  if (current === DELIVERY_STATUS.PENDING || current === DELIVERY_STATUS.CANCELLED) return current
  if (totalOpen <= 0) return DELIVERY_STATUS.SETTLED
  if (hasSettlements) return DELIVERY_STATUS.PARTIALLY_SETTLED
  return DELIVERY_STATUS.DELIVERED
}
