"use client";

import { useMemo, useState } from "react";
import { FLAG, MAIN_CUR, KOTACE, korelace, vahaKat, doHlavni, czDate, shortDate, denVTydnu } from "./lib-ui";

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

// kolik bp týdenního posunu už je „hodně" — kalibrace, ne dogma
const REP_PLNY = 15;
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
    if (list.length < 2) return;
    const [ted, drive] = list;
    // kolik dní uplynulo — když je to zhruba týden, jde o týdenní posun,
    // u starších záznamů se to popíše datem, ať to nesvádí k přehnaným závěrům
    const dnu = Math.round(
      (new Date(ted.klic).getTime() - new Date(drive.klic).getTime()) / 864e5
    );
    const delta = Math.round((ted.bps - drive.bps) * 10) / 10;
    // 26 bp za tři měsíce není totéž co 26 bp za týden — pro sílu měny
    // se posun přepočítá na týdenní tempo, ať jsou měny srovnatelné
    const tydnu = Math.max(1, dnu / 7);
    out[cur] = {
      delta,
      zaTyden: Math.round((delta / tydnu) * 10) / 10,
      z: drive.bps, na: ted.bps,
      odKdy: drive.klic, doKdy: ted.klic, dnu,
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
    const cur = doHlavni(e.cur);
    if (!cur || !MAIN_CUR.includes(cur)) return;
    const v = vahaKat(e.kategorie) * (e.verdict === "+" ? 1 : -1);
    const o = (out[cur] = out[cur] || { suma: 0, udalosti: [] });
    o.suma += v;
    o.udalosti.push({ ...e, vaha: Math.abs(v), znak: e.verdict });
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
    const cur = doHlavni(e.cur);
    if (!cur || !MAIN_CUR.includes(cur)) return;
    const v = vahaKat(e.kategorie);
    if (v === 0) return;
    const o = (out[cur] = out[cur] || { suma: 0, udalosti: [] });
    o.suma += v;
    o.udalosti.push({ ...e, vaha: v });
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
  MAIN_CUR.forEach((c) => { out[c] = { celkovy: null, trend: null, tydny: [] }; });

  (overview || []).forEach((o) => {
    const c = doHlavni(String(o.code || "").trim());
    if (out[c] && o.verdict) out[c].celkovy = o.verdict;
  });

  const hranice = isoPosun(-7 * TYDNU_ZPET);
  const podle = {};
  (weeks || []).forEach((w) => {
    const c = doHlavni(w.cur);
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

    // Počítá se týdenní tempo posunu. Starší srovnání navíc dostane menší
    // váhu — je to pořád informace, ale ne čerstvá.
    const bRep = r ? clamp(r.zaTyden / REP_PLNY, -1, 1) * (r.tydenni ? 1 : 0.75) : null;
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
    ].filter((x) => x.v !== null);

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
  const maxVaha = Math.max(0.1, ...Object.values(out).map((x) => x.vaha));
  Object.values(out).forEach((x) => { x.bias = clamp(x.suma / maxVaha, -1, 1); });
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
  const maxDiv = Math.max(0.001, ...pary.map((p) => p.divergence));
  pary.forEach((p) => {
    p.divRel = p.divergence / maxDiv;
    // Provázané měny se navzájem dotahují, takže rozdíl mezi nimi se hůř
    // promítne do kurzu — skóre se tlumí podle síly korelace.
    p.tlumeni = 1 - p.korelace * 0.6;
    p.skore = Math.round(100 * p.divRel * (0.6 + 0.4 * p.katalyzator) * p.tlumeni);
  });
  return pary.sort((x, y) => y.skore - x.skore);
}

/* ---------- text důvodů ---------- */
const bp = (n) => `${n > 0 ? "+" : ""}${String(n).replace(".", ",")} bp`;
const smerSlovo = (n) => (n > 0 ? "jestřábí" : n < 0 ? "holubičí" : "beze změny");

function duvody(p) {
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
    const rozdilBp = a.rep && b.rep ? Math.round((a.rep.delta - b.rep.delta) * 10) / 10 : null;
    out.push({
      typ: "rep",
      text: casti.join(" · ") + (rozdilBp !== null ? ` → rozdíl ${Math.abs(rozdilBp)} bp` : ""),
    });
  }

  [a, b].forEach((s) => {
    if (!s.fund || !s.fund.udalosti.length) return;
    const top = s.fund.udalosti.slice(0, 2)
      .map((e) => `${e.info} (${e.znak === "+" ? "pozitivní" : "negativní"})`).join(", ");
    out.push({ typ: "fund", text: `${s.cur}: ${top}` });
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
    const top = s.kat.udalosti.slice(0, 3)
      .map((e) => `${e.info} ${denVTydnu(e.date).slice(0, 2)} ${shortDate(e.date)}`).join(", ");
    out.push({ typ: "kat", text: `${s.cur} má před sebou: ${top}` });
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

/* ---------- historie doporučení a jejich úspěšnost ---------- */
function Historie({ focus }) {
  const [otevreny, setOtevreny] = useState(null);
  if (!focus || !focus.length) return null;

  const dnes = new Date().toISOString().slice(0, 10);
  // dnešní snímek je nahoře v hlavním seznamu, tady jde o to, co bylo dřív
  const minule = focus.filter((f) => String(f.date || "").slice(0, 10) < dnes);
  if (!minule.length) return null;

  const hodnocene = minule.filter((f) => f.vysledek && f.vysledek !== "neobchodováno");
  const vyslo = hodnocene.filter((f) => f.vysledek === "vyšlo").length;
  const castecne = hodnocene.filter((f) => f.vysledek === "částečně").length;
  const uspesnost = hodnocene.length
    ? Math.round(((vyslo + castecne * 0.5) / hodnocene.length) * 100)
    : null;

  const podleData = {};
  minule.forEach((f) => {
    const d = String(f.date || "").slice(0, 10);
    (podleData[d] = podleData[d] || []).push(f);
  });

  return (
    <>
      <h3 className="sec-title" style={{ marginTop: 32 }}>Jak to vycházelo</h3>
      <p className="sub" style={{ marginBottom: 12 }}>
        {uspesnost === null
          ? `${minule.length} dřívějších doporučení zatím bez hodnocení. Doplň VÝSLEDEK v Notionu a objeví se tu úspěšnost.`
          : <>Z <b>{hodnocene.length}</b> ohodnocených doporučení vyšlo <b>{vyslo}</b>{castecne ? <> a částečně <b>{castecne}</b></> : null} — úspěšnost <b>{uspesnost} %</b>. Nehodnocená se nepočítají.</>}
      </p>

      {Object.keys(podleData).sort().reverse().slice(0, 8).map((d) => (
        <div key={d} style={{ marginBottom: 14 }}>
          <div className="day-head"><b>Snímek</b> {czDate(d)}</div>
          {podleData[d].sort((a, b) => (a.poradi ?? 99) - (b.poradi ?? 99)).map((f) => {
            const isOpen = otevreny === f.id;
            return (
              <div key={f.id} className="plan">
                <button className="plan-head" onClick={() => setOtevreny(isOpen ? null : f.id)}>
                  <span className="plan-arrow">{isOpen ? "▾" : "▸"}</span>
                  <span className="plan-cur">{f.poradi}. {f.par}</span>
                  <span className={"focus-dir " + (f.smer === "nahoru" ? "up" : "down")}>
                    {f.smer === "nahoru" ? "▲" : "▼"} {f.smer}
                  </span>
                  <span className="plan-ocek">skóre {f.skore}</span>
                  {f.vysledek && (
                    <span className={"pill " + (f.vysledek === "vyšlo" ? "up"
                      : f.vysledek === "nevyšlo" ? "down" : "")}>{f.vysledek}</span>
                  )}
                </button>
                {isOpen && (
                  <div className="plan-body">
                    {f.repricing && (
                      <div className="focus-reason r-rep">
                        <span className="focus-tag">repricing</span><span>{f.repricing}</span>
                      </div>
                    )}
                    {f.duvod && <div className="focus-hist-text">{f.duvod}</div>}
                    {f.poznamka && (
                      <div className="focus-hist-text" style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
                        <b>Co se stalo:</b> {f.poznamka}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ================================ UI ================================ */

export function Focus({ rates, events, positions, overview = [], weeks = [], focus = [], onSaved }) {
  const sila = useMemo(
    () => silaMen({ rates, events, positions, overview, weeks }),
    [rates, events, positions, overview, weeks]
  );
  const pary = useMemo(() => paryPodleSkore(sila), [sila]);
  const [vsechny, setVsechny] = useState(false);
  const [otevreny, setOtevreny] = useState(null);
  const [stav, setStav] = useState({ msg: "", kind: "" });
  const [busy, setBusy] = useState(false);

  const maRep = Object.values(sila).filter((s) => s.maRepricing).length;
  const maTydenni = Object.values(sila).filter((s) => s.rep && s.rep.tydenni).length;
  const zobrazene = vsechny ? pary : pary.slice(0, 6);
  const dnes = new Date().toISOString().slice(0, 10);
  const uzUlozeno = focus.some((f) => String(f.date || "").slice(0, 10) === dnes);

  async function uloz() {
    setBusy(true);
    setStav({ msg: "Ukládám…", kind: "" });
    try {
      const r = await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datum: dnes,
          pary: pary.slice(0, 6).map((p, i) => ({
            poradi: i + 1,
            par: p.id,
            baze: p.baze.cur,
            kvot: p.kvot.cur,
            skore: p.skore,
            smer: p.rozdil > 0 ? "nahoru" : "dolů",
            biasBaze: Math.round(p.baze.bias * 1000) / 1000,
            biasKvot: Math.round(p.kvot.bias * 1000) / 1000,
            divergence: Math.round(p.divergence * 1000) / 1000,
            katalyzator: Math.round(p.katalyzator * 1000) / 1000,
            repricing: duvody(p).filter((d) => d.typ === "rep").map((d) => d.text).join(" "),
            duvod: duvody(p).filter((d) => d.typ !== "rep").map((d) => d.text).join("\n\n"),
          })),
        }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setStav({
        msg: `Uloženo ${j.ulozeno} párů${j.prepsano ? ` (přepsán dřívější snímek)` : ""} ✓`,
        kind: "ok",
      });
      onSaved && onSaved();
    } catch (e) {
      setStav({ msg: "Chyba: " + e.message, kind: "bad" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h3 className="sec-title">Kam mířit příští týden</h3>
      <p className="sub" style={{ marginBottom: 14 }}>
        Skóre stojí hlavně na repricingu — když se výhled sazeb posune o hodně bp, něco
        vyšlo jinak, než trh čekal. Rozdíl mezi dvěma měnami je pak to, co pár tlačí.
        Fundament za minulý týden dává tomu posunu jméno, <b>celkový stav</b> drží sílu
        nasbíranou v předchozích týdnech, nadcházející události říkají, kde bude pohyb,
        a COT je jen potvrzení.
      </p>

      {maTydenni < 2 && (
        <div className="note-box" style={{ textAlign: "left", marginBottom: 18 }}>
          {maRep >= 2 ? (
            <>
              <b>Repricing zatím počítám proti starším záznamům, ne proti minulému týdnu.</b>{" "}
              Ty starší snímky nemají datum ocenění, takže se řadí podle zasedání a posun
              je za delší období — proto má poloviční váhu. Až mi pošleš druhý víkendový
              snímek, přepne se to na skutečný týdenní posun.
            </>
          ) : (
            <>
              <b>Zatím počítám hlavně z fundamentu.</b> Repricing potřebuje aspoň dvě
              ocenění na měnu, ať je co odečítat — teď ho mám u {maRep} z {MAIN_CUR.length}.
              Jakmile doplníš další víkendový snímek sazeb, skóre se opře hlavně o něj.
            </>
          )}
        </div>
      )}

      <div className="focus-list">
        {zobrazene.map((p, i) => {
          const nahoru = p.rozdil > 0;
          const isOpen = otevreny === p.id;
          const dv = duvody(p);
          return (
            <div key={p.id} className={"focus-card" + (i === 0 ? " top" : "")}>
              <button className="focus-head" onClick={() => setOtevreny(isOpen ? null : p.id)}>
                <span className="focus-rank">{i + 1}</span>
                <span className="focus-pair">
                  {FLAG[p.baze.cur]}{FLAG[p.kvot.cur]} {p.baze.cur}/{p.kvot.cur}
                </span>
                <span className={"focus-dir " + (nahoru ? "up" : "down")}>
                  {nahoru ? "▲ spíš nahoru" : "▼ spíš dolů"}
                </span>
                <span className="focus-bar" aria-hidden="true">
                  <i style={{ width: Math.max(4, p.skore) + "%" }} />
                </span>
                <span className="focus-score">{p.skore}</span>
                <span className="focus-arrow">{isOpen ? "▾" : "▸"}</span>
              </button>

              <div className="focus-why">
                {dv.length ? dv[0].text : "Zatím málo dat na vysvětlení."}
              </div>

              {isOpen && (
                <div className="focus-body">
                  {dv.map((d, k) => (
                    <div key={k} className={"focus-reason r-" + d.typ}>
                      <span className="focus-tag">
                        {d.typ === "rep" ? "repricing" : d.typ === "fund" ? "fundament"
                          : d.typ === "stav" ? "celkový stav"
                          : d.typ === "rozpor" ? "⚠ rozpor"
                          : d.typ === "kat" ? "čeká nás" : d.typ === "kor" ? "korelace" : "pozice"}
                      </span>
                      <span>{d.text}</span>
                    </div>
                  ))}
                  <div className="focus-meta">
                    Rozdíl biasů {(Math.abs(p.rozdil)).toFixed(2).replace(".", ",")} ·
                    {" "}Katalyzátory {Math.round(p.katalyzator * 100)} %
                    {p.obaBezRepricingu && " · bez repricingu, jen z fundamentu"}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="focus-actions">
        <button className="btn-primary" onClick={uloz} disabled={busy}>
          {uzUlozeno ? "Přepsat dnešní snímek v Notionu" : "Uložit snímek do Notionu"}
        </button>
        <span className={"status " + stav.kind}>{stav.msg}</span>
        {pary.length > 6 && (
          <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setVsechny(!vsechny)}>
            {vsechny ? "Zobrazit jen top 6" : `Zobrazit všech ${pary.length} párů`}
          </button>
        )}
      </div>
      <p className="sub" style={{ marginTop: 6 }}>
        Uloží se top 6 i s odůvodněním. VÝSLEDEK a POZNÁMKU pak doplníš v Notionu
        po skončení týdne — z toho se časem pozná, jestli ti systém radí dobře.
      </p>

      <Historie focus={focus} />


      <h3 className="sec-title" style={{ marginTop: 32 }}>Síla jednotlivých měn</h3>
      <p className="sub" style={{ marginBottom: 12 }}>
        Z čeho se skóre skládá. Bias je výsledné číslo od −1 (slabá) do +1 (silná).
      </p>
      <div className="hm-wrap" style={{ padding: 0, overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Měna</th>
              <th>Bias</th><th>Repricing</th><th>Fundament</th>
              <th>Celkový stav</th><th>Čeká nás</th><th>COT</th>
            </tr>
          </thead>
          <tbody>
            {MAIN_CUR.map((c) => sila[c])
              .sort((a, b) => b.bias - a.bias)
              .map((s) => (
                <tr key={s.cur}>
                  <td style={{ textAlign: "left", fontWeight: 600 }}>{FLAG[s.cur]} {s.cur}</td>
                  <td>
                    <span className={"pill " + (s.bias > 0.08 ? "up" : s.bias < -0.08 ? "down" : "")}>
                      {s.bias > 0 ? "+" : ""}{s.bias.toFixed(2).replace(".", ",")}
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {s.rep
                      ? <span title={`z ${s.rep.z} bp na ${s.rep.na} bp za ${s.rep.dnu} dní`}>
                          {bp(s.rep.delta)}{!s.rep.tydenni && ` (${bp(s.rep.zaTyden)}/týd.)`}
                        </span>
                      : <span style={{ color: "var(--ink-3)" }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {s.fund
                      ? `${s.fund.suma > 0 ? "+" : ""}${s.fund.suma} (${s.fund.udalosti.length})`
                      : <span style={{ color: "var(--ink-3)" }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {s.bStav === null || s.bStav === undefined
                      ? <span style={{ color: "var(--ink-3)" }}>—</span>
                      : <span title={`souhrn ${s.stav.celkovy || "—"}, trend za ${(s.stav.tydny || []).length} týd.`}>
                          {s.stav.celkovy || "·"} {s.bStav > 0 ? "↑" : s.bStav < 0 ? "↓" : "→"}
                        </span>}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {s.kat
                      ? `${s.kat.udalosti.length}× · váha ${s.kat.suma}`
                      : <span style={{ color: "var(--ink-3)" }}>klid</span>}
                  </td>
                  <td style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                    {s.cot && s.cot.shortTerm ? s.cot.shortTerm : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
