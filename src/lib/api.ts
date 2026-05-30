/**
 * Wie fetch(), aber wirft bei HTTP-Fehlern (4xx/5xx) eine Exception mit
 * der Server-Fehlermeldung. Verhindert, dass React Query-Mutations
 * Fehlerantworten als Erfolg werten.
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string })?.error || `Fehler ${res.status}`)
  }
  return res
}

export const jsonInit = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
