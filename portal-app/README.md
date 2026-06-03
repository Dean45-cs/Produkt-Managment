# Verkäufer-Portal (Einreich-App)

Eigenständige, öffentlich gehostete App, über die deine Verkäufer ihre Verkäufe
einreichen. Läuft getrennt von der Haupt-App (die lokal bleibt). Die Haupt-App
**pusht** die offene Ware hierher und **holt** die Einreichungen ab.

## Architektur

```
Verkäufer (Handy) ──► Portal-App (Vercel) ──► Postgres
                                  ▲   │
                          push    │   │ pull + ack
                       (offene    │   ▼
                        Ware)   Haupt-App (lokal, localhost)  ──► verbucht
```

- **Öffentlich:** `/portal/<token>` – Verkäufer melden sich mit Link + PIN an und
  reichen Verkäufe ein.
- **Geschützt (nur Haupt-App, Header `x-sync-secret`):**
  - `POST /api/sync/sellers` – Verkäufer-Zugänge + offene Ware aktualisieren
  - `GET  /api/sync/submissions` – neue Einreichungen abholen
  - `POST /api/sync/ack` – Verbuchungs-Ergebnis zurückmelden

Diese App verbucht selbst **nichts** – das macht die Haupt-App. Hier liegen nur
die Einreichungen, bis die Haupt-App sie abholt.

## Deployment auf Vercel

1. Neues Vercel-Projekt aus diesem Repo, **Root Directory = `portal-app`**.
2. Eine **Vercel-Postgres-** (oder Neon-)Datenbank anlegen und mit dem Projekt
   verbinden → `DATABASE_URL` wird automatisch gesetzt. Das Schema legt die App
   beim ersten Zugriff selbst an (CREATE TABLE IF NOT EXISTS).
3. Environment-Variablen setzen:
   - `SYNC_SECRET` – identisch zur Haupt-App.
   - `PORTAL_SESSION_SECRET` – langer Zufallswert (optional, sonst SYNC_SECRET).
4. In der **Haupt-App** setzen:
   - `PORTAL_BASE_URL` = die Vercel-URL dieser App (z.B. `https://dein-portal.vercel.app`)
   - `SYNC_SECRET` = derselbe Wert wie hier.

## Lokal entwickeln

```bash
npm install
# lokale Postgres-DB, z.B.:
export DATABASE_URL="postgresql://localhost:5432/portal"
export SYNC_SECRET="dev-secret"
npm run dev   # http://localhost:3001  (Port frei wählen)
```
