/**
 * Geldlogik: Kasse und Bank.
 *
 * Ablauf: Der Verkäufer bringt dir das Geld für die verkaufte Ware — das
 * buchst du als Einnahme in die Kasse. Von der Kasse geht ein Teil weg (die
 * Ausgaben zwischendurch), der Rest wandert per Umbuchung auf die Bank und
 * bleibt dort als Rücklage für die nächste Bestellung liegen.
 *
 * Es bucht sich nichts von allein — jede Zeile entsteht durch einen Klick.
 * Der Saldo eines Kontos wird nie gespeichert, sondern immer aus den
 * Buchungen summiert; damit kann er gar nicht erst auseinanderlaufen.
 */

export const ACCOUNT_KIND = {
  CASH: 'CASH',
  BANK: 'BANK',
} as const

export const ACCOUNT_KIND_LABELS: Record<string, string> = {
  CASH: 'Kasse',
  BANK: 'Bank',
}

export const ENTRY_KIND = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  TRANSFER: 'TRANSFER',
} as const

export const ENTRY_KIND_LABELS: Record<string, string> = {
  INCOME: 'Einnahme',
  EXPENSE: 'Ausgabe',
  TRANSFER: 'Umbuchung',
}

export const ENTRY_KIND_VARIANTS: Record<string, 'success' | 'destructive' | 'secondary'> = {
  INCOME: 'success',
  EXPENSE: 'destructive',
  TRANSFER: 'secondary',
}

export const ENTRY_CATEGORY = {
  SALE: 'SALE',
  PURCHASE: 'PURCHASE',
  FUN: 'FUN',
  OTHER: 'OTHER',
} as const

export const ENTRY_CATEGORY_LABELS: Record<string, string> = {
  SALE: 'Verkauf',
  PURCHASE: 'Wareneinkauf',
  FUN: 'Ausgabe zwischendurch',
  OTHER: 'Sonstiges',
}

/** Welche Kategorien in welchem Buchungstyp zur Auswahl stehen. */
export const CATEGORIES_BY_KIND: Record<string, string[]> = {
  INCOME: [ENTRY_CATEGORY.SALE, ENTRY_CATEGORY.OTHER],
  EXPENSE: [ENTRY_CATEGORY.PURCHASE, ENTRY_CATEGORY.FUN, ENTRY_CATEGORY.OTHER],
  TRANSFER: [],
}

export function isValidEntryKind(kind: unknown): kind is keyof typeof ENTRY_KIND {
  return typeof kind === 'string' && kind in ENTRY_KIND
}

export function isValidCategory(kind: string, category: unknown): boolean {
  if (category == null || category === '') return true
  return typeof category === 'string' && (CATEGORIES_BY_KIND[kind] ?? []).includes(category)
}

export interface BalanceInput {
  accountId: string
  amountCt: number
}

/** Saldo je Konto aus den Buchungen. */
export function accountBalances(entries: BalanceInput[]): Map<string, number> {
  const balances = new Map<string, number>()
  for (const e of entries) {
    balances.set(e.accountId, (balances.get(e.accountId) ?? 0) + e.amountCt)
  }
  return balances
}

export interface TransferHalf {
  accountId: string
  bookedAt: Date
  amountCt: number
  kind: string
  note: string | null
  transferId: string
}

/**
 * Eine Umbuchung sind zwei gespiegelte Zeilen mit gemeinsamer `transferId`:
 * Abgang auf dem Quellkonto, Zugang auf dem Zielkonto. So bleibt die Summe
 * über alle Konten unverändert und beide Hälften lassen sich zusammen wieder
 * löschen.
 */
export function buildTransfer(params: {
  fromAccountId: string
  toAccountId: string
  amountCt: number
  bookedAt: Date
  note?: string | null
  transferId: string
}): [TransferHalf, TransferHalf] {
  const { fromAccountId, toAccountId, amountCt, bookedAt, note, transferId } = params
  const common = { bookedAt, kind: ENTRY_KIND.TRANSFER, note: note ?? null, transferId }
  return [
    { ...common, accountId: fromAccountId, amountCt: -Math.abs(amountCt) },
    { ...common, accountId: toAccountId, amountCt: Math.abs(amountCt) },
  ]
}

/**
 * Vorzeichen einer Buchung aus ihrem Typ. Einnahmen kommen rein, Ausgaben
 * gehen raus — der Betrag wird im Formular immer positiv eingegeben.
 */
export function signedAmount(kind: string, amountCt: number): number {
  const abs = Math.abs(amountCt)
  return kind === ENTRY_KIND.EXPENSE ? -abs : abs
}
