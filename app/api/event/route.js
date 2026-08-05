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

// poskládá properties z těla požadavku; vynechá, co není vyplněné
function buildProps(b, { requireInfo = true } = {}) {
  const props = {};

  if (b.info !== undefined && String(b.info).trim() !== "") {
    props.INFO = { title: [{ text: { content: String(b.info).slice(0, 1900) } }] };
  } else if (requireInfo) {
    throw new Error("Chybí popis události.");
  }

  if (b.cur) {
    if (!CUR_PAGE[b.cur]) throw new Error(`Neznámá měna: ${b.cur}`);
    props.MĚNA = { relation: [{ id: CUR_PAGE[b.cur] }] };
  }
  if (b.date) props.DATUM = { date: { start: b.date } };
  if (b.obdobi) props.OBDOBÍ = { date: { start: b.obdobi } };
  if (b.kategorie) props.KATEGORIE = { select: { name: b.kategorie } };
  if (b.dopad) props.DOPAD = { select: { name: b.dopad } };
  if (b.jednotka) props.JEDNOTKA = { select: { name: b.jednotka } };
  if (b.verdict) props.VÝSLEDEK = { select: { name: b.verdict } };

  const num = (v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(",", ".")));
  const a = num(b.aktual), o = num(b.ocekavani), p = num(b.predchozi);
  if (a !== undefined && !isNaN(a)) props.AKTUÁL = { number: a };
  if (o !== undefined && !isNaN(o)) props.OČEKÁVÁNÍ = { number: o };
  if (p !== undefined && !isNaN(p)) props.PŘEDCHOZÍ = { number: p };

  // Meziměsíční čísla patří ke stejné události jako meziroční — jeden záznam,
  // jeden popis, dvě sady hodnot.
  const aM = num(b.aktualMoM), oM = num(b.ocekavaniMoM), pM = num(b.predchoziMoM);
  if (aM !== undefined && !isNaN(aM)) props["AKTUÁL MoM"] = { number: aM };
  if (oM !== undefined && !isNaN(oM)) props["OČEKÁVÁNÍ MoM"] = { number: oM };
  if (pM !== undefined && !isNaN(pM)) props["PŘEDCHOZÍ MoM"] = { number: pM };

  return props;
}

/* Nová událost */
export async function POST(req) {
  try {
    const b = await req.json();
    if (!b.cur) return Response.json({ error: "Vyber měnu." }, { status: 400 });
    if (!b.date) return Response.json({ error: "Doplň datum." }, { status: 400 });
    if (!b.kategorie) return Response.json({ error: "Vyber kategorii." }, { status: 400 });

    const props = buildProps(b);
    const page = await api("/pages", "POST", {
      parent: { database_id: DB.FUNDAMENT },
      properties: props,
    });
    return Response.json({ ok: true, id: page.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

/* Doplnění existující (naplánované) události */
export async function PATCH(req) {
  try {
    const b = await req.json();
    if (!b.id) return Response.json({ error: "Chybí ID záznamu." }, { status: 400 });

    const props = buildProps(b, { requireInfo: false });
    if (Object.keys(props).length === 0) {
      return Response.json({ error: "Není co uložit." }, { status: 400 });
    }
    await api(`/pages/${b.id}`, "PATCH", { properties: props });
    return Response.json({ ok: true, id: b.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
