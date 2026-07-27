import { DB, queryDatabase, val, curFromRelation } from "../../../lib/notion";

export const dynamic = "force-dynamic";

const SECTIONS = [
  "SAZBY", "PRESS CONFERENCE", "CPI", "NEZAMĚSTNANOST", "ZAMĚSTNANOST",
  "BREAKING NEWS", "PROJEVY", "PCE", "PPI", "NFP", "JOBLESS CLAIMS",
  "JOLTS", "PMI", "HDP", "RETAIL SALES", "SPOTŘEBITELSKÁ DŮVĚRA", "NEMOVITOSTI",
];

export async function GET() {
  try {
    const [celkovy, weekly, fundament] = await Promise.all([
      queryDatabase(DB.CELKOVY),
      queryDatabase(DB.WEEKLY, {
        sorts: [{ property: "DATUM", direction: "descending" }],
      }),
      queryDatabase(DB.FUNDAMENT, {
        sorts: [{ property: "DATUM", direction: "descending" }],
      }),
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

    const events = fundament.slice(0, 120).map((p) => {
      const P = p.properties;
      const a = val.number(P["AKTUÁL"]);
      const o = val.number(P["OČEKÁVÁNÍ"]);
      return {
        info: val.title(P["INFO"]),
        cur: curFromRelation(val.relation(P["MĚNA"])),
        date: val.date(P["DATUM"]),
        verdict: val.select(P["VÝSLEDEK"]),
        kategorie: val.select(P["KATEGORIE"]),
        dopad: val.select(P["DOPAD"]),
        aktual: a,
        ocekavani: o,
        predchozi: val.number(P["PŘEDCHOZÍ"]),
        prekvapeni: a !== null && o !== null ? Math.round((a - o) * 1000) / 1000 : null,
      };
    });

    return Response.json({ overview, weeks, events, sections: SECTIONS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
