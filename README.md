# Fundament — dashboard

Webová verze přehledu forexového fundamentu. Čte data z Notionu (databáze FUNDAMENT,
FUNDAMENT - WEEKLY PŘEHLED a FUNDAMENT - CELKOVÝ PŘEHLED) a umí do FUNDAMENTU zapisovat
nové události.

Notion token zůstává na serveru — do prohlížeče se nikdy nedostane.

## Co potřebuješ

1. **Notion integrační token** z [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Integraci **pustit ke stránce OBCHODNÍ DENÍK** (··· → Connections)
3. Účet na **GitHubu** a **Vercelu** (oba zdarma)

## Nasazení na Vercel

1. Nahraj tuhle složku na GitHub jako nový repozitář.
2. Na [vercel.com](https://vercel.com) dej **Add New → Project** a vyber ten repozitář.
3. Před nasazením rozbal **Environment Variables** a přidej:

   | Name | Value |
   |---|---|
   | `NOTION_TOKEN` | tvůj token (začíná `ntn_` nebo `secret_`) |

4. Klikni **Deploy**. Za minutu dostaneš adresu typu `fundament-dashboard.vercel.app`.

## Vložení do Notionu

Na stránku v Notionu napiš `/embed`, vlož adresu z Vercelu a potvrď.

## Lokální spuštění

```bash
npm install
echo "NOTION_TOKEN=sem_vloz_token" > .env.local
npm run dev
```

Pak otevři http://localhost:3000

## Když to nefunguje

**"Chybí NOTION_TOKEN"** — proměnná není nastavená ve Vercelu. Přidej ji v Settings →
Environment Variables a dej Redeploy.

**"Could not find database"** nebo prázdná data — integrace nemá přístup. V Notionu otevři
OBCHODNÍ DENÍK → ··· → Connections a přidej ji. Přístup se propíše na všechny databáze pod ní.

**Změnily se ID databází** — pokud bys deník kopíroval nebo přesouval, uprav `lib/notion.js`,
kde jsou ID databází i stránek měn.
