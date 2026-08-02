import { DB, CUR_PAGE } from "../../../lib/notion";

export const dynamic = "force-dynamic";

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

const txt = (s, max = 1900) =>
  s ? { rich_text: [{ text: { content: String(s).slice(0, max) } }] } : undefined;

/* Uloží týdenní snímek. Když už snímek k tomuto datu existuje, smaže se
   (v Notionu se archivuje) a zapíše se znovu — ať nevznikají duplicity,
   když si to za víkend spustíš dvakrát. */
export async function POST(req) {
  try {
    const b = await req.json();
    const datum = String(b.datum || "").slice(0, 10);
    const pary = Array.isArray(b.pary) ? b.pary : [];

    if (!datum) return Response.json({ error: "Chybí datum snímku." }, { status: 400 });
    if (!pary.length) return Response.json({ error: "Není co ukládat." }, { status: 400 });

    // starý snímek ke stejnému datu pryč
    const stare = await api(`/databases/${DB.FOCUS}/query`, "POST", {
      filter: { property: "DATUM", date: { equals: datum } },
      page_size: 100,
    });
    for (const p of stare.results || []) {
      await api(`/pages/${p.id}`, "PATCH", { archived: true });
    }

    let ulozeno = 0;
    for (const p of pary.slice(0, 12)) {
      const props = {
        PÁR: { title: [{ text: { content: String(p.par || "?").slice(0, 100) } }] },
        DATUM: { date: { start: datum } },
        POŘADÍ: { number: p.poradi ?? null },
        SKÓRE: { number: p.skore ?? null },
        "BIAS BÁZE": { number: p.biasBaze ?? null },
        "BIAS KVÓTOVANÉ": { number: p.biasKvot ?? null },
        DIVERGENCE: { number: p.divergence ?? null },
        KATALYZÁTORY: { number: p.katalyzator ?? null },
      };
      if (p.smer) props["SMĚR"] = { select: { name: p.smer } };
      if (CUR_PAGE[p.baze]) props["BÁZE"] = { relation: [{ id: CUR_PAGE[p.baze] }] };
      if (CUR_PAGE[p.kvot]) props["KVÓTOVANÁ"] = { relation: [{ id: CUR_PAGE[p.kvot] }] };
      const rep = txt(p.repricing, 500);
      if (rep) props["REPRICING"] = rep;
      const duv = txt(p.duvod);
      if (duv) props["DŮVOD"] = duv;

      await api("/pages", "POST", { parent: { database_id: DB.FOCUS }, properties: props });
      ulozeno++;
    }

    return Response.json({ ok: true, ulozeno, prepsano: (stare.results || []).length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
