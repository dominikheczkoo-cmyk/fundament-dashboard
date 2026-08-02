// Čistý výpočet modelu FOCUS — bez Reactu, ať ho může použít
// jak stránka v prohlížeči, tak serverové API pro naplánovanou úlohu.
// Jediné místo, kde je logika: kdyby byla dvakrát, rozejde se.

import {
  FLAG, MAIN_CUR, KOTACE, korelace, vahaKat, jePodstatne, kategorieUdalosti,
  czDate, shortDate, denVTydnu,
} from "../app/lib-ui";

/* ------------------------------------------------------------------ *
 *  KAM MÍŘIT PŘÍŠTÍ TÝDEN
 *
 *  Myšlenka: když se během týdne výrazně přecenilo očekávání sazeb,
 *  znamená to, že něco vyšlo jinak, než trh čekal. Repricing je tedy
 *  cenový otisk fundamentu — a rozdíl v repricingu mezi dvěma měnami
 *  je přesně to, co ten pár tlačí jedním směrem.
 *
 *  Skládá se ze tří vrstev, v tomhle pořadí důležitosti:
 *    1. repricing  — o kolik bp se posunul výhled do konce roku (60 %)
 *    2. fundament  — jak dopadly události za poslední týden (30 %)
 *    3. COT        — jestli s tím poziční data souhlasí (10 %)
 *  Když repricing chybí (jen jedno ocenění v historii), váha se
 *  přelije na fundament a COT, ať to funguje i první týden.
 * ------------------------------------------------------------------ */

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
// Vrátí číslo, jen když je to opravdu číslo. Chybějící hodnota se musí
// chovat jako „nevím" (null), ne jako NaN — NaN se totiž šíří dál a
// jediná měna s neúplnými daty by rozhodila pořadí všech párů.
const cislo = (n) => (typeof n === "number" && Number.isFinite(n) ? n : null);

// kolik bp týdenního posunu už je „hodně" — kalibrace, ne dogma
const REP_PLNY = 15;
// posun pravděpodobnosti zvýšení o 25 procentních bodů za týden = plný signál
const SANCE_PLNA = 25;
// součet vážených verdiktů, který bereme jako plný fundamentální signál
const FUND_PLNY = 20;

const DEN = 864e5;
const isoPosun = (dnu) => new Date(Date.now() + dnu * DEN).toISOString().slice(0, 10);

/* ---------- 1. repricing: poslední vs. předchozí ocenění ---------- */
export function repricingPodleMen(rates) {
  const dnes = new Date().toISOString().slice(0, 10);
  const podle = {};
  rates.forEach((r) => {
    const klic = r.poradi || r.date;
    if (!r.cur || !klic || r.bps === null || r.bps === undefined) return;
    if (String(klic).slice(0, 10) > dnes) return;
    (podle[r.cur] = podle[r.cur] || []).push({ ...r, klic });
  });
  const out = {};
  Object.entries(podle).forEach(([cur, list]) => {
    list.sort((a, b) => String(b.klic).localeCompare(String(a.klic)));
    if (list.length < 2) {
      // I bez srovnání má smysl znát odůvodnění posledního ocenění.
      // Všechna číselná pole musí být výslovně null — kdyby chyběla,
      // výpočet z nich udělá NaN a jedno NaN pak rozbije celý žebříček.
      if (list.length === 1 && list[0].duvod) {
        out[cur] = {
          delta: null, zaTyden: null,
          sanceDelta: null, sanceZaTyden: null,
          z: null, na: null, sanceZ: null, sanceNa: null,
          odKdy: null, doKdy: list[0].klic, dnu: null,
          duvod: list[0].duvod, tydenni: false, odhad: false,
          samotny: true,
        };
      }
      return;
    }
    const [ted, drive] = list;
    // kolik dní uplynulo — když je to zhruba týden, jde o týdenní posun,
    // u starších záznamů se to popíše datem, ať to nesvádí k přehnaným závěrům
    const dnu = Math.round(
      (new Date(ted.klic).getTime() - new Date(drive.klic).getTime()) / 864e5
    );
    const delta = Math.round((ted.bps - drive.bps) * 10) / 10;
    // Posun pravděpodobnosti zvýšení na nejbližším zasedání, v procentních
    // bodech. Krátkodobější a často ostřejší signál než výhled do konce roku.
    const sanceDelta =
      ted.sanceZvyseni !== null && ted.sanceZvyseni !== undefined &&
      drive.sanceZvyseni !== null && drive.sanceZvyseni !== undefined
        ? Math.round((ted.sanceZvyseni - drive.sanceZvyseni) * 1000) / 10
        : null;
    // 26 bp za tři měsíce není totéž co 26 bp za týden — pro sílu měny
    // se posun přepočítá na týdenní tempo, ať jsou měny srovnatelné
    const tydnu = Math.max(1, dnu / 7);
    out[cur] = {
      delta,
      zaTyden: Math.round((delta / tydnu) * 10) / 10,
      z: drive.bps, na: ted.bps,
      sanceDelta,
      sanceZaTyden: sanceDelta === null ? null : Math.round((sanceDelta / tydnu) * 10) / 10,
      sanceZ: drive.sanceZvyseni, sanceNa: ted.sanceZvyseni,
      odKdy: drive.klic, doKdy: ted.klic, dnu,
      // proč se to přecenilo — text z pole „Důvod změny a předchozí hodnota"
      duvod: ted.duvod || null,
      tydenni: dnu > 0 && dnu <= 10,
      // datum předchozího snímku je jen odhad ze zasedání, ne skutečné ocenění
      odhad: !!drive.odhadDatum,
    };
  });
  return out;
}

/* ---------- 2. fundament za poslední týden ---------- */
function fundamentPodleMen(events) {
  const dnes = new Date().toISOString().slice(0, 10);
  const tydenZpet = isoPosun(-7);
  const out = {};
  events.forEach((e) => {
    const d = String(e.date || "").slice(0, 10);
    if (!d || d > dnes || d < tydenZpet) return;
    if (!e.verdict || e.verdict === "0") return;
    // Jen podstatné kategorie — drobnosti sílu měny neurčují. Když kategorie
    // chybí, zkusí se odvodit z textu, jinak by ručně psané záznamy vypadly.
    const { kat, odvozeno } = kategorieUdalosti(e);
    if (!jePodstatne(kat)) return;
    // Bez doHlavni: u eura se počítá výhradně eurozóna. Německá, francouzská
    // a španělská data jsou zdrojová, ale do síly EUR se nesčítají.
    const cur = e.cur;
    if (!cur || !MAIN_CUR.includes(cur)) return;
    const v = vahaKat(kat) * (e.verdict === "+" ? 1 : -1);
    const o = (out[cur] = out[cur] || { suma: 0, udalosti: [] });
    o.suma += v;
    o.udalosti.push({ ...e, kat, odvozeno, vaha: Math.abs(v), znak: e.verdict });
  });
  Object.values(out).forEach((o) => o.udalosti.sort((a, b) => b.vaha - a.vaha));
  return out;
}

/* ---------- 3. katalyzátory: co teprve přijde ---------- */
function katalyzatoryPodleMen(events) {
  const dnes = new Date().toISOString().slice(0, 10);
  const zaTyden = isoPosun(7);
  const out = {};
  events.forEach((e) => {
    const d = String(e.date || "").slice(0, 10);
    if (!d || d <= dnes || d > zaTyden) return;
    // Stejná dvě pravidla jako u fundamentu: jen podstatné kategorie
    // a u eura výhradně eurozóna.
    const { kat } = kategorieUdalosti(e);
    if (!jePodstatne(kat)) return;
    const cur = e.cur;
    if (!cur || !MAIN_CUR.includes(cur)) return;
    const v = vahaKat(kat);
    if (v === 0) return;
    const o = (out[cur] = out[cur] || { suma: 0, udalosti: [] });
    o.suma += v;
    o.udalosti.push({ ...e, kat, vaha: v });
  });
  Object.values(out).forEach((o) =>
    o.udalosti.sort((a, b) => b.vaha - a.vaha || String(a.date).localeCompare(String(b.date)))
  );
  return out;
}

/* ---------- 4. celkový stav měny ----------
   Měna může být silná z předchozích týdnů, i když se zrovna tenhle týden
   nic nepřecenilo. Bereme dva zdroje: aktuální VÝSLEDEK z CELKOVÉHO
   PŘEHLEDU (uživatelův vlastní souhrnný úsudek) a trend posledních týdnů
   z WEEKLY PŘEHLEDU, kde starší týdny váží míň. */
const ZNAK = (v) => (v === "+" ? 1 : v === "-" || v === "−" ? -1 : 0);
const TYDNU_ZPET = 6;

function stavPodleMen(overview, weeks) {
  const out = {};
  MAIN_CUR.forEach((c) => {
    out[c] = { celkovy: null, trend: null, tydny: [], shrnuti: null, sekce: null };
  });

  (overview || []).forEach((o) => {
    const c = String(o.code || "").trim();
    if (!out[c]) return;
    if (o.verdict) out[c].celkovy = o.verdict;
    if (o.summary) out[c].shrnuti = o.summary;
    if (o.sections) out[c].sekce = o.sections;
  });

  const hranice = isoPosun(-7 * TYDNU_ZPET);
  const podle = {};
  (weeks || []).forEach((w) => {
    const c = w.cur;
    if (!c || !MAIN_CUR.includes(c) || !w.date) return;
    if (String(w.date).slice(0, 10) < hranice) return;
    (podle[c] = podle[c] || []).push(w);
  });

  Object.entries(podle).forEach(([c, list]) => {
    list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    // nejnovější týden váží 1, každý starší o čtvrtinu míň
    let suma = 0, vahaCelkem = 0;
    list.slice(0, TYDNU_ZPET).forEach((w, i) => {
      const v = Math.pow(0.75, i);
      suma += ZNAK(w.verdict) * v;
      vahaCelkem += v;
    });
    if (!out[c]) return;
    out[c].trend = vahaCelkem ? suma / vahaCelkem : null;
    out[c].tydny = list.slice(0, TYDNU_ZPET);
  });

  return out;
}

/* ---------- 5. COT: nejnovější záznam na měnu ---------- */
function cotPodleMen(positions) {
  const out = {};
  positions.forEach((p) => {
    if (!p.cur) return;
    const cur = out[p.cur];
    if (!cur || String(p.date || "").localeCompare(String(cur.date || "")) > 0) out[p.cur] = p;
  });
  return out;
}

/* ---------- síla měny: složení vrstev do jednoho čísla ---------- */
export function silaMen({ rates, events, positions, overview, weeks }) {
  const rep = repricingPodleMen(rates);
  const fund = fundamentPodleMen(events);
  const kat = katalyzatoryPodleMen(events);
  const cot = cotPodleMen(positions);
  const stav = stavPodleMen(overview, weeks);

  const maxKat = Math.max(1, ...MAIN_CUR.map((c) => (kat[c] ? kat[c].suma : 0)));

  const out = {};
  MAIN_CUR.forEach((c) => {
    const r = rep[c] || null;
    const f = fund[c] || null;
    const k = kat[c] || null;
    const s = cot[c] || null;

    // Repricing má dvě části: výhled do konce roku (dlouhý horizont) a
    // pravděpodobnost změny na nejbližším zasedání (krátký, ostřejší).
    // Když je k dispozici obojí, váží 60:40 ve prospěch nejbližšího zasedání,
    // protože ten posun je bezprostřednější. Počítá se týdenní tempo.
    const vyhledZaTyden = r ? cislo(r.zaTyden) : null;
    const sanceZaTyden = r ? cislo(r.sanceZaTyden) : null;
    const bVyhled = vyhledZaTyden === null ? null : clamp(vyhledZaTyden / REP_PLNY, -1, 1);
    const bSance = sanceZaTyden === null ? null : clamp(sanceZaTyden / SANCE_PLNA, -1, 1);
    const bRepSurovy =
      bVyhled === null && bSance === null ? null
        : bSance === null ? bVyhled
        : bVyhled === null ? bSance
        : bSance * 0.6 + bVyhled * 0.4;
    // Starší srovnání než týden dostane menší váhu — pořád informace, ale ne čerstvá.
    const bRep = bRepSurovy === null ? null : bRepSurovy * (r.tydenni ? 1 : 0.75);
    const bFund = f ? clamp(f.suma / FUND_PLNY, -1, 1) : null;
    const bCot = s && s.shortTerm ? (/bull/i.test(s.shortTerm) ? 0.5 : /bear/i.test(s.shortTerm) ? -0.5 : 0) : null;

    // Celkový stav: souhrnný VÝSLEDEK měny a trend posledních týdnů.
    // Drží sílu, kterou si měna nasbírala dřív, i když se tenhle týden nic
    // nepřecenilo. Souhrn váží víc, protože je to přímý úsudek uživatele.
    const st = stav[c] || {};
    const bStavCelkovy = st.celkovy ? ZNAK(st.celkovy) : null;
    const bStav =
      bStavCelkovy === null && st.trend === null ? null
        : bStavCelkovy === null ? st.trend
        : st.trend === null ? bStavCelkovy
        : bStavCelkovy * 0.6 + st.trend * 0.4;

    // Chybějící vrstvu nedopočítáváme z těch zbylých — měna, o které víme
    // jen COT, nesmí vypadat stejně přesvědčivě jako měna s repricingem
    // i fundamentem. Chybějící data prostě táhnou k nule.
    const slozky = [
      { v: bRep, w: 0.45 }, { v: bFund, w: 0.25 },
      { v: bStav, w: 0.2 }, { v: bCot, w: 0.1 },
    ].filter((x) => cislo(x.v) !== null);

    // Když si celkový stav a repricing protiřečí, je to samo o sobě
    // informace: fundament drží, ale trh to zatím nezaceňuje (nebo naopak).
    const rozpor =
      bRep !== null && bStav !== null &&
      Math.sign(bRep) !== 0 && Math.sign(bStav) !== 0 &&
      Math.sign(bRep) !== Math.sign(bStav) &&
      Math.abs(bRep) > 0.15 && Math.abs(bStav) > 0.3;

    out[c] = {
      cur: c, rep: r, fund: f, kat: k, cot: s, stav: st, bStav, rozpor,
      suma: slozky.reduce((a, x) => a + x.v * x.w, 0),
      vaha: slozky.reduce((a, x) => a + x.w, 0),
      katNorm: k ? k.suma / maxKat : 0,
      maRepricing: !!r,
    };
  });

  // Měřítko se přizpůsobí tomu, kolik dat vůbec existuje: když repricing
  // nemá zatím nikdo, škála se roztáhne podle nejlépe pokryté měny, ať
  // jsou rozdíly pořád čitelné.
  const maxVaha = Math.max(0.1, ...Object.values(out).map((x) => cislo(x.vaha) ?? 0));
  Object.values(out).forEach((x) => {
    const s = cislo(x.suma);
    x.bias = s === null ? 0 : clamp(s / maxVaha, -1, 1);
  });
  return out;
}

/* ---------- páry ---------- */
export function paryPodleSkore(sila) {
  const pary = [];
  for (let i = 0; i < KOTACE.length; i++) {
    for (let j = i + 1; j < KOTACE.length; j++) {
      const a = sila[KOTACE[i]], b = sila[KOTACE[j]];
      if (!a || !b) continue;
      const rozdil = a.bias - b.bias;                   // + = báze silnější
      const divergence = Math.abs(rozdil) / 2;          // 0..1
      const katalyzator = (a.katNorm + b.katNorm) / 2;  // 0..1
      const kor = korelace(a.cur, b.cur);
      pary.push({
        id: `${a.cur}/${b.cur}`,
        baze: a, kvot: b, rozdil,
        divergence, katalyzator, korelace: kor,
        obaBezRepricingu: !a.maRepricing && !b.maRepricing,
      });
    }
  }

  // Skóre je součin, ne součet. Katalyzátory mají signál zesílit, ne ho
  // vyrobit — pár, kde jsou obě měny stejně silné, nemá kam jít, i kdyby
  // ho čekal sebenabitější týden. Divergence se škáluje k nejlepšímu páru,
  // ať jsou čísla čitelná i ve chvíli, kdy jsou biasy celkově nízké.
  // Do maxima jdou jen platná čísla — jediné NaN by jinak udělalo NaN
  // z maxima a tím pádem ze skóre všech párů, což by řazení úplně vypnulo.
  const platne = pary.map((p) => cislo(p.divergence)).filter((v) => v !== null);
  const maxDiv = Math.max(0.001, ...platne);
  pary.forEach((p) => {
    const div = cislo(p.divergence) ?? 0;
    const kat = cislo(p.katalyzator) ?? 0;
    p.divRel = div / maxDiv;
    // Provázané měny se navzájem dotahují, takže rozdíl mezi nimi se hůř
    // promítne do kurzu — skóre se tlumí podle síly korelace.
    p.tlumeni = 1 - p.korelace * 0.6;
    p.skore = Math.round(100 * p.divRel * (0.6 + 0.4 * kat) * p.tlumeni);
    if (!Number.isFinite(p.skore)) p.skore = 0;
  });
  return pary.sort((x, y) => y.skore - x.skore);
}

/* ---------- text důvodů ---------- */
export const bp = (n) => `${n > 0 ? "+" : ""}${String(n).replace(".", ",")} bp`;
const smerSlovo = (n) => (n > 0 ? "jestřábí" : n < 0 ? "holubičí" : "beze změny");

export function duvody(p) {
  const out = [];
  const { baze: a, kvot: b } = p;

  if (a.rep || b.rep) {
    const casti = [];
    [a, b].forEach((s) => {
      if (!s.rep) return;
      casti.push(
        `${s.cur} ${bp(s.rep.delta)} ${smerSlovo(s.rep.delta)}`
        + (s.rep.tydenni ? "" : ` (za ${s.rep.dnu} dní od ${czDate(s.rep.odKdy)}, tj. ${bp(s.rep.zaTyden)}/týden)`)
      );
    });
    const rozdilBp =
      a.rep && b.rep && a.rep.delta !== null && b.rep.delta !== null
        ? Math.round((a.rep.delta - b.rep.delta) * 10) / 10 : null;
    if (casti.length) {
      out.push({
        typ: "rep",
        text: casti.join(" · ") + (rozdilBp !== null ? ` → rozdíl ${Math.abs(rozdilBp)} bp` : ""),
      });
    }
    // Posun pravděpodobnosti na nejbližším zasedání
    const sanceCasti = [];
    [a, b].forEach((s) => {
      if (!s.rep || s.rep.sanceDelta === null || s.rep.sanceDelta === undefined) return;
      const d = s.rep.sanceDelta;
      sanceCasti.push(
        `${s.cur} ${d > 0 ? "+" : ""}${d} p. b. `
        + `(${Math.round(s.rep.sanceZ * 100)} % → ${Math.round(s.rep.sanceNa * 100)} %)`
      );
    });
    if (sanceCasti.length) {
      out.push({
        typ: "sance",
        text: `Šance na zvýšení na nejbližším zasedání: ${sanceCasti.join(" · ")}`,
      });
    }

    // Proč se to přecenilo — text, který si u sazeb zapisuješ
    [a, b].forEach((s) => {
      if (!s.rep || !s.rep.duvod) return;
      out.push({ typ: "repduvod", cur: s.cur, text: s.rep.duvod });
    });
  }

  [a, b].forEach((s) => {
    if (!s.fund || !s.fund.udalosti.length) return;
    const top = s.fund.udalosti.slice(0, 3).map((e) => {
      const nazev = String(e.info || "").trim();
      // dlouhý popis zkrátit na první větu, ať je řádek čitelný
      const kratky = nazev.length > 110
        ? nazev.slice(0, nazev.slice(0, 110).lastIndexOf(".") + 1 || 110).trim()
        : nazev;
      return `${e.znak === "+" ? "+" : "−"} ${e.kat}${e.odvozeno ? "*" : ""} · ${kratky}`;
    });
    out.push({
      typ: "fund",
      cur: s.cur,
      text: `${s.cur} (součet ${s.fund.suma > 0 ? "+" : ""}${s.fund.suma} z ${s.fund.udalosti.length} událostí):\n`
        + top.join("\n"),
    });
  });

  [a, b].forEach((s) => {
    if (s.bStav === null || s.bStav === undefined) return;
    const st = s.stav || {};
    const casti = [];
    if (st.celkovy) {
      casti.push(`celkový stav ${st.celkovy === "+" ? "pozitivní"
        : st.celkovy === "-" ? "negativní" : "smíšený"}`);
    }
    if (st.trend !== null && st.trend !== undefined && st.tydny && st.tydny.length) {
      const smer = st.trend > 0.15 ? "drží se nahoře"
        : st.trend < -0.15 ? "táhne dolů" : "bez jasného směru";
      casti.push(`posledních ${st.tydny.length} týdnů ${smer}`);
    }
    if (casti.length) out.push({ typ: "stav", text: `${s.cur}: ${casti.join(", ")}` });
    // celé shrnutí měny z CELKOVÉHO PŘEHLEDU
    if (st.shrnuti) out.push({ typ: "shrnuti", cur: s.cur, text: st.shrnuti });
  });

  [a, b].forEach((s) => {
    if (!s.rozpor) return;
    const fundNahoru = s.bStav > 0;
    out.push({
      typ: "rozpor",
      text: `${s.cur}: fundament ${fundNahoru ? "drží nahoře" : "je slabý"}, ale sazby se `
        + `přeceňují ${fundNahoru ? "holubičím" : "jestřábím"} směrem `
        + `(${bp(s.rep.delta)}). Buď to trh ještě nezacenil, nebo je v ceně něco jiného — `
        + `zkontroluj na grafu, jestli se kurz vůbec hýbe.`,
    });
  });

  [a, b].forEach((s) => {
    if (!s.kat || !s.kat.udalosti.length) return;
    const top = s.kat.udalosti.slice(0, 4)
      .map((e) => `${denVTydnu(e.date).slice(0, 2)} ${shortDate(e.date)} ${e.info} (váha ${e.vaha})`)
      .join("\n");
    out.push({ typ: "kat", text: `${s.cur} má před sebou:\n${top}` });
  });

  if (p.korelace) {
    out.push({
      typ: "kor",
      text: `${a.cur} a ${b.cur} jsou provázané měny — hýbou se často spolu, `
        + `takže rozdíl mezi nimi se do kurzu promítne hůř. Skóre jsem kvůli tomu `
        + `snížil o ${Math.round(p.korelace * 60)} %.`,
    });
  }

  const cotA = a.cot && a.cot.shortTerm, cotB = b.cot && b.cot.shortTerm;
  if (cotA || cotB) {
    const znak = (t) => (/bull/i.test(t || "") ? 1 : /bear/i.test(t || "") ? -1 : 0);
    const cotRozdil = znak(cotA) - znak(cotB);
    const sedi = cotRozdil === 0 ? null : Math.sign(cotRozdil) === Math.sign(p.rozdil);
    out.push({
      typ: "cot",
      text: `COT: ${a.cur} ${cotA || "—"}, ${b.cur} ${cotB || "—"}`
        + (sedi === null ? "" : sedi ? " — pozice sedí se směrem" : " — pozice jdou proti, ber opatrněji"),
    });
  }
  return out;
}

