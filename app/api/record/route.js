import { DB, CUR_PAGE, EXTRA_PAGE } from "../../../lib/notion";

export const dynamic = "force-dynamic";

const ALL_PAGES = { ...CUR_PAGE, ...EXTRA_PAGE };

const NOTION_VERSION = "2022-06-28";

function hdrs() {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("Chybí NOTION_TOKEN v proměnných prostředí.");
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function api(path, method, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: hdrs(),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

async function createPage(databaseId, properties) {
  return api("/pages", "POST", { parent: { database_id: databaseId }, properties });
}

// najde nejnovější existující řádek pro danou měnu
async function findExisting(databaseId, relProp, pageId) {
  const r = await api(`/databases/${databaseId}/query`, "POST", {
    filter: { property: relProp, relation: { contains: pageId } },
    sorts: [{ property: "Datum", direction: "descending" }],
    page_size: 1,
  });
  return r.results && r.results.length ? r.results[0].id : null;
}

// přepíše existující, nebo založí nový, když žádný není
async function upsert(databaseId, relProp, pageId, properties, mode) {
  if (mode === "update") {
    const existing = await findExisting(databaseId, relProp, pageId);
    if (existing) {
      await api(`/pages/${existing}`, "PATCH", { properties });
      return { id: existing, updated: true };
    }
  }
  const page = await createPage(databaseId, properties);
  return { id: page.id, updated: false };
}

// text s mezerou jako oddělovačem tisíců, ať to v Notionu vypadá stejně jako dosud
function fmtNum(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  if (isNaN(n)) return null;
  return n.toLocaleString("cs-CZ").replace(/ /g, " ");
}

export async function POST(req) {
  try {
    const b = await req.json();

    if (!b.cur || !ALL_PAGES[b.cur]) {
      return Response.json({ error: "Neznámý instrument." }, { status: 400 });
    }
    if (!b.date) {
      return Response.json({ error: "Chybí datum." }, { status: 400 });
    }
    const rel = { relation: [{ id: ALL_PAGES[b.cur] }] };

    /* ---------- ÚROKOVÉ SAZBY ---------- */
    if (b.kind === "rate") {
      const ocek = b.ocekavani === "" ? null : Number(String(b.ocekavani).replace(",", "."));
      const pred = b.predchozi === "" ? null : Number(String(b.predchozi).replace(",", "."));
      const sance = b.sance === "" ? null : Number(String(b.sance).replace(",", "."));
      if (ocek === null || isNaN(ocek)) {
        return Response.json({ error: "Doplň očekávanou sazbu." }, { status: 400 });
      }
      const props = {
        // v Notionu je title "Důvod změny a předchozí hodnota"
        "Důvod změny a předchozí hodnota": {
          title: [{ text: { content: String(b.duvod || `${b.cur} — sazby`).slice(0, 1900) } }],
        },
        MĚNA: rel,
        Datum: { date: { start: b.date } },
        // procentní pole: 3.75 % ukládáme jako 0.0375
        Očekávání: { number: ocek / 100 },
      };
      if (pred !== null && !isNaN(pred)) props["Předchozí Výsledek"] = { number: pred / 100 };
      if (sance !== null && !isNaN(sance)) props["Procentní šance"] = { number: sance / 100 };
      if (b.doKonceRoku) props["Snížení do konce roku"] = { rich_text: [{ text: { content: String(b.doKonceRoku).slice(0, 300) } }] };
      if (b.pocetSnizeni) props["Počet ročních snížení"] = { rich_text: [{ text: { content: String(b.pocetSnizeni).slice(0, 300) } }] };

      const r = await upsert(DB.SAZBY, "MĚNA", ALL_PAGES[b.cur], props, b.mode);
      return Response.json({ ok: true, id: r.id, updated: r.updated });
    }

    /* ---------- SENTIMENT TRHU ---------- */
    if (b.kind === "sentiment") {
      const long = fmtNum(b.long);
      if (long === null) {
        return Response.json({ error: "Doplň hodnotu Long." }, { status: 400 });
      }
      const props = {
        // v Notionu je title "Long"
        Long: { title: [{ text: { content: long } }] },
        Měna: rel,
        Datum: { date: { start: b.date } },
      };
      const short = fmtNum(b.short);
      const spread = fmtNum(b.spread);
      if (short !== null) props["Short"] = { rich_text: [{ text: { content: short } }] };
      if (spread !== null) props["Spread"] = { rich_text: [{ text: { content: spread } }] };
      if (b.shortTerm) props["Short Term Výsledek"] = { select: { name: b.shortTerm } };
      if (b.longTerm) props["Long Term Výsledek"] = { select: { name: b.longTerm } };

      const r = await upsert(DB.SENTIMENT, "Měna", ALL_PAGES[b.cur], props, b.mode);
      return Response.json({ ok: true, id: r.id, updated: r.updated });
    }

    return Response.json({ error: "Neznámý typ záznamu." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
