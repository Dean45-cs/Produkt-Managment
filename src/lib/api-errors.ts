import { NextResponse } from 'next/server'

/**
 * Wandelt bekannte Prisma-Fehler in saubere HTTP-Antworten um, statt einen
 * 500er durchzureichen. Wird in den Route-Handlern als Catch-All genutzt.
 *
 * - P2002: Unique-Constraint verletzt (z.B. doppelte SKU / Kategoriename)
 * - P2003: Fremdschlüssel ungültig (z.B. Bezug auf nicht existierendes Produkt)
 * - P2025: Datensatz nicht gefunden (Update/Delete auf unbekannte ID)
 * - P2014: Beziehung verhindert Löschen (noch referenziert)
 */
export function handlePrismaError(err: unknown): NextResponse {
  const code = (err as { code?: string })?.code
  switch (code) {
    case 'P2002': {
      const target = (err as { meta?: { target?: string[] | string } })?.meta?.target
      const field = Array.isArray(target) ? target.join(', ') : target
      return NextResponse.json(
        { error: `Wert existiert bereits${field ? ` (${field})` : ''}` },
        { status: 409 }
      )
    }
    case 'P2003':
      return NextResponse.json(
        { error: 'Verknüpfter Datensatz existiert nicht oder wird noch verwendet' },
        { status: 409 }
      )
    case 'P2014':
      return NextResponse.json(
        { error: 'Datensatz wird noch von anderen Einträgen verwendet und kann nicht gelöscht werden' },
        { status: 409 }
      )
    case 'P2025':
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    default:
      // Unbekannter Fehler → bewusst generisch, keine internen Details leaken.
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}

/** Prüft, ob ein Wert eine positive ganze Zahl ist (> 0). */
export function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0
}

/** Prüft, ob ein Wert eine nicht-negative ganze Zahl ist (>= 0). */
export function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}
