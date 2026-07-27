// Server-side Notion helper. Token nikdy neopustí server.

const NOTION_VERSION = "2022-06-28";
const API = "https://api.notion.com/v1";

export const DB = {
  CELKOVY: "d9b32cd8adc183a19346810ba19751a6",
  WEEKLY: "e4432cd8adc1834a86b5810766588f5f",
  FUNDAMENT: "47a32cd8adc182b99568817ada656d16",
};

// stránky měn v DATABÁZI MĚNY
export const CUR_PAGE = {
  EUR: "d0832cd8adc1833c992101eec3aa41dc",
  USD: "baf32cd8adc18232a3960184b095a120",
  GBP: "24632cd8adc1829e80df81d728a6b32a",
  JPY: "ed532cd8adc18312bdb20190b7312c3a",
  CAD: "b3632cd8adc183c49f1401c629ad0a1d",
  AUD: "a4932cd8adc18337a23601ed78efb601",
  NZD: "2ab32cd8adc182de870a01b0c21210b9",
  CHF: "9af32cd8adc1824e93fe81de65f8d669",
};

// obrácená mapa: id stránky (bez pomlček) -> kód měny
const BY_ID = {};
Object.entries(CUR_PAGE).forEach(([code, id]) => {
  BY_ID[id.replace(/-/g, "")] = code;
});

export function curFromRelation(rel) {
  if (!rel || !rel.length) return null;
  const id = String(rel[0].id || "").replace(/-/g, "");
  return BY_ID[id] || null;
}

function headers() {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("Chybí NOTION_TOKEN v proměnných prostředí.");
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function call(path, body, method = "POST") {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.message ? json.message : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// Projde všechny stránky databáze (Notion stránkuje po 100).
export async function queryDatabase(dbId, body = {}) {
  let all = [];
  let cursor;
  do {
    const page = await call(`/databases/${dbId}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
      ...body,
    });
    all = all.concat(page.results || []);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor && all.length < 500);
  return all;
}

/* ---------- čtení hodnot z Notion property ---------- */
export const val = {
  title: (p) => (p && p.title ? p.title.map((t) => t.plain_text).join("") : ""),
  text: (p) => (p && p.rich_text ? p.rich_text.map((t) => t.plain_text).join("") : ""),
  select: (p) => (p && p.select ? p.select.name : null),
  date: (p) => (p && p.date ? p.date.start : null),
  number: (p) => (p && typeof p.number === "number" ? p.number : null),
  relation: (p) => (p && p.relation ? p.relation : []),
};

export async function createEvent(props) {
  return call("/pages", {
    parent: { database_id: DB.FUNDAMENT },
    properties: props,
  });
}
