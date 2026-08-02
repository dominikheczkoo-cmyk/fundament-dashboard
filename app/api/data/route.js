import { DB, queryDatabase, val, curFromRelation } from "../../../lib/notion";

export const dynamic = "force-dynamic";

const SECTIONS = [
  "SAZBY", "PRESS CONFERENCE", "CPI", "NEZAMĚSTNANOST", "ZAMĚSTNANOST",
  "BREAKING NEWS", "PROJEVY", "PCE", "PPI", "NFP", "JOBLESS CLAIMS",
  "JOLTS", "PMI", "HDP", "RETAIL SALES", "SPOTŘEBITELSKÁ DŮVĚRA", "NEMOVITOSTI",
];

// "-11 530" / "- 8 775" -> -11530 / -8775
function parseNum(s) {
  if (s === null || s === undefined) return null;
  const clean = String(s).replace(/\s| /g, "").replace(",", ".");
  if (clean === "" || clean === "-") return null;
  const n = Number(clean);
  return isNaN(n) ? null : n;
}

export async function GET() {
  try {
    const [celkovy, weekly, fundament, sazby, sentiment] = await Promise.all([
      queryDatabase(DB.CELKOVY),
      queryDatabase(DB.WEEKLY, {
        sorts: [{ property: "DATUM", direction: "descending" }],
      }),
      queryDatabase(DB.FUNDAMENT, {
        sorts: [{ property: "DATUM", direction: "descending" }],
      }),
      queryDatabase(DB.SAZBY),
      queryDatabase(DB.SENTIMENT),
    ]);

    const overview = celkovy.map((p) => {
      const P = p.properties;
      const row = {
        code: val.title(P["ZÁZNAM"]).trim(),
        verdict: val.select(P["VÝSLEDEK"]),
        summary: val.text(P["SHRNUTÍ"]),
        updated: val.date(P["LAST_UPDATED"]),
        sections: {},
      };
      SECTIONS.forEach((s) => {
        row.sections[s] = P[s] ? val.text(P[s]) : "";
      });
      return row;
    });

    const weeks = weekly.map((p) => {
      const P = p.properties;
      return {
        label: val.title(P["ZÁZNAM"]),
        cur: curFromRelation(val.relation(P["MĚNA"])),
        date: val.date(P["DATUM"]),
        verdict: val.select(P["VÝSLEDEK"]),
        summary: val.text(P["SHRNUTÍ"]),
      };
    });

    const events = fundament.slice(0, 400).map((p) => {
      const P = p.properties;
      const a = val.number(P["AKTUÁL"]);
      const o = val.number(P["OČEKÁVÁNÍ"]);
      const prev = val.number(P["PŘEDCHOZÍ"]);
      return {
        id: p.id,
        info: val.title(P["INFO"]),
        cur: curFromRelation(val.relation(P["MĚNA"])),
        date: val.date(P["DATUM"]),
        obdobi: val.date(P["OBDOBÍ"]),
        verdict: val.select(P["VÝSLEDEK"]),
        kategorie: val.select(P["KATEGORIE"]),
        dopad: val.select(P["DOPAD"]),
        jednotka: val.select(P["JEDNOTKA"]),
        aktual: a,
        ocekavani: o,
        predchozi: prev,
        prekvapeni: a !== null && o !== null ? Math.round((a - o) * 1000) / 1000 : null,
        zmena: a !== null && prev !== null ? Math.round((a - prev) * 1000) / 1000 : null,
      };
    });

    // z textu "38 bps up" / "-16 bps" vytáhne znaménkové číslo
    function bpsZTextu(s) {
      if (!s) return null;
      const m = String(s).match(/(-?\d+(?:[.,]\d+)?)\s*bp/i);
      if (!m) return null;
      let n = Number(String(m[1]).replace(",", "."));
      if (isNaN(n)) return null;
      if (/down|cut|sníž/i.test(s) && n > 0) n = -n;
      return n;
    }

    const rates = sazby.map((p) => {
      const P = p.properties;
      const ocek = val.number(P["Očekávání"]);
      const pred = val.number(P["Předchozí Výsledek"]);
      const vyhled = val.text(P["Výhled do konce roku"]);
      return {
        cur: curFromRelation(val.relation(P["MĚNA"])),
        ocekavani: ocek,
        predchozi: pred,
        zmena: ocek !== null && pred !== null ? Math.round((ocek - pred) * 1e6) / 1e6 : null,
        sance: val.number(P["Procentní šance"]),
        doKonceRoku: vyhled,
        bps: bpsZTextu(vyhled),
        pocetSnizeni: val.text(P["Počet kroků do konce roku"]),
        duvod: val.title(P["Důvod změny a předchozí hodnota"]),
        date: val.date(P["DATUM OCENĚNÍ"]),
        zasedani: val.date(P["ZASEDÁNÍ"]),
      };
    }).filter((r) => r.cur);

    const positions = sentiment.map((p) => {
      const P = p.properties;
      return {
        cur: curFromRelation(val.relation(P["Měna"] || P["MĚNA"])),
        long: parseNum(val.title(P["Long"])),
        short: parseNum(val.text(P["Short"])),
        spread: parseNum(val.text(P["Spread"])),
        shortTerm: val.select(P["Short Term Výsledek"]),
        longTerm: val.select(P["Long Term Výsledek"]),
        date: val.date(P["Datum"]),
      };
    }).filter((r) => r.cur);

    return Response.json({ overview, weeks, events, rates, positions, sections: SECTIONS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
