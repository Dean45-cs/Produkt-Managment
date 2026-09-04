/**
 * Ein Kontakt (`Supplier`) kann zwei Rollen haben, auch beide gleichzeitig:
 *  - Verkäufer  – dein Partner/Auslieferer, der Ware mitnimmt und face2face verkauft
 *  - Lieferant  – der Großhändler, bei dem du die Ware bestellst
 */

export const CONTACT_ROLE = {
  SELLER: 'seller',
  WHOLESALER: 'wholesaler',
} as const

export type ContactRole = (typeof CONTACT_ROLE)[keyof typeof CONTACT_ROLE]

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  seller: 'Verkäufer',
  wholesaler: 'Lieferant',
}

/**
 * Nach so vielen Tagen gilt eine Ladung als überfällig, wenn beim Verkäufer
 * keine eigene Frist hinterlegt ist. Die Zeiträume sind je Verkäufer
 * unterschiedlich – deshalb ist das nur der Rückfallwert.
 */
export const DEFAULT_SETTLE_DAYS = 3

/** Übersetzt `?role=` aus der URL in ein Prisma-Where-Fragment. */
export function roleFilter(role: string | null): { isSeller?: boolean; isWholesaler?: boolean } {
  if (role === CONTACT_ROLE.SELLER) return { isSeller: true }
  if (role === CONTACT_ROLE.WHOLESALER) return { isWholesaler: true }
  return {}
}

/** Beschreibt die Rollen eines Kontakts als lesbaren Text. */
export function roleLabel(contact: { isSeller: boolean; isWholesaler: boolean }): string {
  const roles: string[] = []
  if (contact.isSeller) roles.push(CONTACT_ROLE_LABELS.seller)
  if (contact.isWholesaler) roles.push(CONTACT_ROLE_LABELS.wholesaler)
  return roles.length ? roles.join(' & ') : 'Ohne Rolle'
}

/**
 * Liest die Rollen-/Fristfelder aus einem Request-Body. Gibt `error` zurück,
 * wenn die Angaben unbrauchbar sind (statt still etwas Falsches zu speichern).
 * Ob am Ende überhaupt eine Rolle gesetzt ist, prüft die Route mit
 * `hasAnyRole()` – erst nach dem Zusammenführen mit dem gespeicherten Stand.
 */
export interface ContactRoleData {
  isSeller?: boolean
  isWholesaler?: boolean
  expectedSettleDays?: number | null
}

export function parseContactRoles(
  body: Record<string, unknown>
): { error: string } | { data: ContactRoleData } {
  const data: ContactRoleData = {}

  if (body.isSeller !== undefined) data.isSeller = Boolean(body.isSeller)
  if (body.isWholesaler !== undefined) data.isWholesaler = Boolean(body.isWholesaler)

  if (body.expectedSettleDays !== undefined) {
    const raw = body.expectedSettleDays
    if (raw === null || raw === '') {
      data.expectedSettleDays = null
    } else {
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 1 || n > 365) {
        return { error: 'Abrechnungsfrist muss eine ganze Zahl zwischen 1 und 365 Tagen sein' }
      }
      data.expectedSettleDays = n
    }
  }

  return { data }
}

/**
 * Ein Kontakt ohne Rolle taucht in keiner Auswahl mehr auf – das ist fast
 * immer ein Versehen. Aufrufen, nachdem die Änderung auf den gespeicherten
 * Stand gelegt wurde.
 */
export function hasAnyRole(contact: { isSeller?: boolean; isWholesaler?: boolean }): boolean {
  return Boolean(contact.isSeller || contact.isWholesaler)
}

export const NO_ROLE_ERROR = 'Bitte mindestens eine Rolle wählen: Verkäufer oder Lieferant'
