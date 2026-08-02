"use client";

import { useMemo, useState } from "react";
import {
  FLAG, MAIN_CUR, KOTACE, korelace, vahaKat, jePodstatne, kategorieUdalosti,
  czDate, shortDate, denVTydnu,
} from "./lib-ui";
import { silaMen, paryPodleSkore, repricingPodleMen, duvody, bp } from "../lib/model";
export { silaMen, paryPodleSkore, repricingPodleMen };

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
        <br />
        Počítají se <b>jen podstatné kategorie</b> — press conference, sazby, CPI a PCE,
        trh práce, projevy a breaking news. PMI, PPI, HDP, retail sales ani
        spotřebitelská důvěra sem nepatří.
        U eura se bere <b>výhradně eurozóna</b>, národní data z Německa, Francie
        a Španělska jsou jen zdrojová.
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
                        {d.typ === "rep" ? "repricing"
                          : d.typ === "sance" ? "šance"
                          : d.typ === "repduvod" ? `proč ${d.cur}`
                          : d.typ === "fund" ? "fundament"
                          : d.typ === "stav" ? "celkový stav"
                          : d.typ === "shrnuti" ? `shrnutí ${d.cur}`
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
