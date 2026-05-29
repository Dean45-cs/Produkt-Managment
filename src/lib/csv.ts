/**
 * CSV-Erzeugung für Excel-Export (deutsches Locale).
 * Verwendet ';' als Trennzeichen (deutsches Excel-Standard) und ein UTF-8 BOM,
 * damit Umlaute in Excel korrekt dargestellt werden.
 */

export type CsvCell = string | number | null | undefined

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Felder mit Trennzeichen, Anführungszeichen oder Zeilenumbruch müssen gequotet werden
  if (/[;"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function arrayToCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(';'))
  return '﻿' + lines.join('\r\n')
}

/** Cent-Betrag als deutsche Dezimalzahl (z.B. 1234 -> "12,34") ohne Währungssymbol. */
export function centsToCsvNumber(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/** Datum als ISO-ähnliches deutsches Format (TT.MM.JJJJ) für CSV. */
export function dateToCsv(date: Date | string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('de-DE')
}

/** Erstellt eine NextResponse-kompatible CSV-Antwort als Download. */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
