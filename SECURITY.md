# Verschlüsselung & Zugangsschutz

Die gesamte Datenbank (`dev.db`) wird mit **AES-256 (SQLCipher)** verschlüsselt.
Ohne dein **Master-Passwort** ist die Datei unlesbar – selbst wenn jemand sie
kopiert. Zusätzlich ist die App durch eine **Login-Sperre** geschützt.

## So funktioniert es

- Beim Start ist die App **gesperrt**. Du gibst dein Master-Passwort auf der
  `/unlock`-Seite ein. Daraus wird der AES-Schlüssel abgeleitet (durch SQLCipher,
  PBKDF2). Das Passwort wird **nirgends gespeichert**.
- Der entschlüsselte Zugriff lebt nur im **Arbeitsspeicher** des Servers. Nach
  einem Neustart musst du erneut entsperren.
- **Auto-Sperre:** Nach 15 Minuten ohne Aktivität (einstellbar über
  `IDLE_TIMEOUT_MINUTES`) wird der Schlüssel automatisch aus dem Speicher
  entfernt und das Master-Passwort erneut verlangt – wichtig am geteilten PC.
- Es gibt **kein Backdoor / keine Wiederherstellung**: Vergisst du das Passwort,
  sind die Daten unwiederbringlich verloren. (Das ist der Sinn starker Verschlüsselung.)

## Einrichtung

1. **Abhängigkeiten installieren** (enthält jetzt den verschlüsselungsfähigen
   SQLite-Treiber `better-sqlite3-multiple-ciphers`, als `better-sqlite3` eingebunden):
   ```bash
   npm install
   npx prisma generate
   ```

2. **Session-Schlüssel setzen** – `.env.local` anlegen (wird nicht eingecheckt):
   ```bash
   cp .env.example .env.local
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   # Ausgabe als SESSION_SECRET in .env.local eintragen
   ```

3. **Datenbank vorbereiten** – je nach Ausgangslage:

   - **Du hast schon eine (unverschlüsselte) `dev.db`** → einmalig verschlüsseln:
     ```bash
     DB_MASTER_PASSWORD="deinMasterPasswort" npm run db:encrypt
     ```
   - **Frischer Start ohne `dev.db`** → einfach die App starten; beim ersten
     `/unlock` legst du das Master-Passwort fest und eine neue, verschlüsselte
     DB wird inkl. Schema angelegt. Optional Demodaten laden:
     ```bash
     DB_MASTER_PASSWORD="deinMasterPasswort" npm run db:seed
     ```

4. **Starten** und im Browser mit dem Master-Passwort entsperren:
   ```bash
   npm run dev -- -p 3005
   ```

## Migrationen

Prisma Migrate kann eine verschlüsselte DB nicht öffnen. Daher werden die
SQL-Migrationen aus `prisma/migrations/` beim Entsperren **automatisch** auf der
entschlüsselten Verbindung angewandt (nachverfolgt in `_app_migrations`).
Neue Migrationen entwickelst du wie bisher (SQL-Datei in `prisma/migrations/`);
sie werden beim nächsten Entsperren angewandt. `npx prisma migrate deploy` gegen
die verschlüsselte Datei ist **nicht** mehr nötig/möglich.

## Verkäufer-Portal (separater Eingang)

Verkäufer reichen ihre Verkäufe über einen **persönlichen Link** (`/portal/<token>`)
plus **PIN** ein. Damit das **auch bei gesperrter Haupt-App** funktioniert, liegen
diese Einreichungen in einer **eigenen** Datei `portal.db` mit **eigenem Schlüssel**
(`PORTAL_SECRET`, fällt auf `SESSION_SECRET` zurück) – getrennt vom
Master-verschlüsselten `dev.db`.

- **Zugang:** langer Zufalls-Token im Link (≈192 Bit) + PIN (scrypt-gehasht,
  Rate-Limit nach 5 Fehlversuchen). Nach PIN-Eingabe ein signiertes Portal-Cookie.
- **Datenfluss:** Eine Einreichung verändert **nie direkt** die Hauptdaten. Sie
  landet im Eingang und wird – sobald die App entsperrt ist – über dieselbe,
  geprüfte Abrechnungslogik **automatisch verbucht** (Mengen werden gegen die noch
  offene Ware validiert; Überverkäufe landen als „Problem" im Owner-Eingang).
- **Owner-Verwaltung** (`/api/portal-admin/...`, Portal aktivieren, Link/PIN) bleibt
  hinter dem Master-Passwort. Nur das Verkäufer-Portal selbst ist öffentlich.
- **Trade-off:** `portal.db` ist mit einem auf dem Server hinterlegten Schlüssel
  verschlüsselt (nicht mit deinem Master-Passwort). Es enthält bewusst nur die
  Einreichungen und einen Spiegel der offenen Mengen – nicht deine gesamte
  Geschäftsdatenbank. Setze in Produktion ein eigenes, langes `PORTAL_SECRET`.

`portal.db` ist wie `dev.db` in `.gitignore` und wird nie eingecheckt.

## Was geschützt ist – und was nicht

**Geschützt:**
- Die Datei `dev.db` ist im Ruhezustand vollständig verschlüsselt. Kopien,
  Backups oder Cloud-Sync der Datei sind ohne Master-Passwort wertlos.
- Die laufende App ist hinter einem signierten Login-Cookie gesperrt
  (gefälschte Cookies werden per HMAC abgewiesen).

**Nicht (vollständig) geschützt:**
- Während die App **läuft und entsperrt** ist, liegt der Schlüssel im
  Server-Speicher. Wer in diesem Moment Code als dein Benutzerkonto auf der
  Maschine ausführen kann, könnte die Daten lesen. Sperre die App (Button
  „Sperren") bzw. beende den Server, wenn du fertig bist, und sperre deinen
  Rechner.
- Empfehlung als zusätzliche Schicht: **Festplattenverschlüsselung** des
  Betriebssystems (FileVault / BitLocker / LUKS) aktivieren.

`dev.db`, `.env.local` und der generierte Prisma-Client sind in `.gitignore`
und werden nie eingecheckt.
