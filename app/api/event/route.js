import { createEvent, CUR_PAGE } from "../../../lib/notion";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const b = await req.json();

    if (!b.info || !String(b.info).trim()) {
      return Response.json({ error: "Chybí popis události." }, { status: 400 });
    }
    if (!CUR_PAGE[b.cur]) {
      return Response.json({ error: "Neznámá měna." }, { status: 400 });
    }
    if (!b.date) {
      return Response.json({ error: "Chybí datum." }, { status: 400 });
    }

    const props = {
      INFO: { title: [{ text: { content: String(b.info).slice(0, 1900) } }] },
      MĚNA: { relation: [{ id: CUR_PAGE[b.cur] }] },
      DATUM: { date: { start: b.date } },
    };
    if (b.kategorie) props["KATEGORIE"] = { select: { name: b.kategorie } };
    if (b.dopad) props["DOPAD"] = { select: { name: b.dopad } };
    if (b.jednotka) props["JEDNOTKA"] = { select: { name: b.jednotka } };
    if (b.obdobi) props["OBDOBÍ"] = { date: { start: b.obdobi } };
    if (b.verdict) props["VÝSLEDEK"] = { select: { name: b.verdict } };
    if (b.aktual !== null && b.aktual !== undefined && b.aktual !== "")
      props["AKTUÁL"] = { number: Number(b.aktual) };
    if (b.ocekavani !== null && b.ocekavani !== undefined && b.ocekavani !== "")
      props["OČEKÁVÁNÍ"] = { number: Number(b.ocekavani) };
    if (b.predchozi !== null && b.predchozi !== undefined && b.predchozi !== "")
      props["PŘEDCHOZÍ"] = { number: Number(b.predchozi) };

    const page = await createEvent(props);
    return Response.json({ ok: true, id: page.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
