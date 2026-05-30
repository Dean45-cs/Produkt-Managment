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
