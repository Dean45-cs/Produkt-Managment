export function centsToEuro(cents: number): string {
  const n = Number.isFinite(cents) ? cents : 0
  return (n / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export function euroToCents(euro: number): number {
  const n = Math.round(euro * 100)
  return Number.isFinite(n) ? n : 0
}
