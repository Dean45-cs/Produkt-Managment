export function centsToEuro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  })
}

export function euroToCents(euro: number): number {
  return Math.round(euro * 100)
}

export function centsToDecimal(cents: number): number {
  return cents / 100
}
