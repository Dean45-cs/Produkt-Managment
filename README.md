This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Aufbau: zwei Apps

- **Haupt-App** (dieses Verzeichnis): läuft **lokal** beim Inhaber, verschlüsselte
  SQLite hinter Master-Passwort. Verwaltet Produkte, Ladungen, Abrechnungen.
- **Verkäufer-Portal** (`portal-app/`): eigene, **öffentlich gehostete** App (Vercel
  + Postgres), über die Verkäufer ihre Verkäufe per Link + PIN einreichen.

Die Haupt-App **synchronisiert** mit dem Portal: sie lädt die offene Ware hoch und
holt Einreichungen ab, die sie lokal als Abrechnung verbucht. Details:
[`SECURITY.md`](./SECURITY.md) und [`portal-app/README.md`](./portal-app/README.md).

## Der Ablauf

1. **Einkauf** — Ware beim *Lieferanten* bestellen. Beim Wareneingang steigt
   der Bestand.
2. **Ladung** — einem *Verkäufer* eine feste Stückzahl mitgeben. Bei der
   Übergabe sinkt der Bestand sofort.
3. **Abrechnen** — der Verkäufer verkauft face2face und rechnet ab, auch in
   mehreren Teilabrechnungen über beliebige Zeiträume. Wie lange eine Ladung
   draußen sein darf, bevor sie als überfällig gilt, ist je Verkäufer
   einstellbar.
4. **Geld verbuchen** — das kassierte Geld als Einnahme in die **Kasse**, die
   Rücklage für die nächste Bestellung per Umbuchung auf die **Bank**, den
   Rest als Ausgabe. Gebucht wird ausschließlich von Hand; die Seite
   *Kasse & Bank* zeigt nur, wozu noch keine Buchung existiert.

*Verkäufer* und *Lieferant* sind Rollen desselben Kontakts — wer beides ist,
bekommt beide Häkchen. Produkte lassen sich zu **Arten** zusammenfassen, unter
denen die einzelnen **Sorten** hängen; jede Sorte hat eigenen Bestand und
eigenen Preis.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
