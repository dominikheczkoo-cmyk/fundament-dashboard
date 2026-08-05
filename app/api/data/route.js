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
    const [celkovy, weekly, fundament, sazby, sentiment, focusRows] = await Promise.all([
      queryDatabase(DB.CELKOVY),
      queryDatabase(DB.WEEKLY, {
        sorts: [{ property: "DATUM", direction: "descending" }],
      }),
      queryDatabase(DB.FUNDAMENT, {
        sorts: [{ property: "DATUM", direction: "descending" }],
      }),
      queryDatabase(DB.SAZBY),
      queryDatabase(DB.SENTIMENT),
      // historie doporučení se může tvářit jako prázdná, dokud nic neuložíš
      queryDatabase(DB.FOCUS, {
        sorts: [{ property: "DATUM", direction: "descending" }],
      }).catch(() => []),
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
        typ: val.select(P["TYP"]),
        odhadDopadu: val.text(P["ODHAD DOPADU"]),
        zdrojVypisku: val.select(P["ZDROJ VÝPISKU"]),
        dopad: val.select(P["DOPAD"]),
        jednotka: val.select(P["JEDNOTKA"]),
        aktual: a,
        ocekavani: o,
        predchozi: prev,
        aktualMoM: val.number(P["AKTUÁL MoM"]),
        ocekavaniMoM: val.number(P["OČEKÁVÁNÍ MoM"]),
        predchoziMoM: val.number(P["PŘEDCHOZÍ MoM"]),
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

    // Procento u každé měny znamená něco jiného — u jedné šanci na zvýšení,
    // u druhé šanci, že se nic nestane. Pro srovnání se všechno převede na
    // jedno měřítko: pravděpodobnost zvýšení na příštím zasedání.
    // Zbytek u „beze změny" se přiřadí podle toho, kam míří výhled do konce roku.
    function sanceNaZvyseni(sance, smer, vyhledBp) {
      if (sance === null || sance === undefined) return null;
      if (smer === "zvýšení") return sance;
      if (smer === "snížení") return 0;
      if (smer === "beze změny") {
        if (vyhledBp === null) return null;
        return vyhledBp > 0 ? Math.round((1 - sance) * 1000) / 1000 : 0;
      }
      return null; // bez vyplněného směru radši nic než špatně
    }

    const rates = sazby.map((p) => {
      const P = p.properties;
      const ocek = val.number(P["Očekávání"]);
      const pred = val.number(P["Předchozí Výsledek"]);
      const vyhled = val.text(P["Výhled do konce roku"]);
      const dOceneni = val.date(P["DATUM OCENĚNÍ"]);
      const dZasedani = val.date(P["ZASEDÁNÍ"]);
      const sance = val.number(P["Procentní šance"]);
      const smerSance = val.select(P["ŠANCE NA"]);
      const vyhledBp = bpsZTextu(vyhled);
      return {
        cur: curFromRelation(val.relation(P["MĚNA"])),
        ocekavani: ocek,
        predchozi: pred,
        zmena: ocek !== null && pred !== null ? Math.round((ocek - pred) * 1e6) / 1e6 : null,
        sance,
        smerSance,
        sanceZvyseni: sanceNaZvyseni(sance, smerSance, vyhledBp),
        doKonceRoku: vyhled,
        bps: vyhledBp,
        pocetSnizeni: val.text(P["Počet kroků do konce roku"]),
        duvod: val.title(P["Důvod změny a předchozí hodnota"]),
        date: dOceneni,
        zasedani: dZasedani,
        // Starší záznamy datum ocenění nemají — pro řazení historie
        // se u nich použije datum zasedání, ať je co s čím srovnat.
        poradi: dOceneni || dZasedani,
        odhadDatum: !dOceneni && !!dZasedani,
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

    const focus = focusRows.map((p) => {
      const P = p.properties;
      return {
        id: p.id,
        par: val.title(P["PÁR"]),
        date: val.date(P["DATUM"]),
        poradi: val.number(P["POŘADÍ"]),
        skore: val.number(P["SKÓRE"]),
        smer: val.select(P["SMĚR"]),
        biasBaze: val.number(P["BIAS BÁZE"]),
        biasKvot: val.number(P["BIAS KVÓTOVANÉ"]),
        divergence: val.number(P["DIVERGENCE"]),
        katalyzator: val.number(P["KATALYZÁTORY"]),
        repricing: val.text(P["REPRICING"]),
        duvod: val.text(P["DŮVOD"]),
        vysledek: val.select(P["VÝSLEDEK"]),
        poznamka: val.text(P["POZNÁMKA"]),
      };
    });

    return Response.json({ overview, weeks, events, rates, positions, focus, sections: SECTIONS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
