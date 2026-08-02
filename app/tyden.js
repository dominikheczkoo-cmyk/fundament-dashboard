"use client";

import { useState } from "react";
import { FLAG, CUR_NAME, JEDNOTKY, czDate, denVTydnu, filled } from "./lib-ui";

/* Naplánované události — ty, které ještě nemají vyplněnou aktuální hodnotu.
   Doplníš je rovnou tady a uloží se zpátky do Notionu. */
// Kostra z kalendáře se pozná podle dvou věcí zároveň:
//  1. má vyplněnou KATEGORII — import ji nastavuje vždy
//  2. má krátký název z Forex Factory ("Core CPI Flash Estimate y/y")
// Ručně psaná poznámka bývá bez kategorie nebo s dlouhým popisem, takže sem nespadne
// a nebude se tvářit jako nedodělaná práce.
const KOSTRA_MAX_DELKA = 90;
const jeKostra = (e) =>
  !!(e.kategorie && String(e.kategorie).trim()) &&
  String(e.info || "").trim().length <= KOSTRA_MAX_DELKA;

// Kategorie, kde se nic nevyhodnocuje — nemá smysl je nabízet k doplnění.
const NEVYHODNOCUJE_SE = ["BANK HOLIDAY"];

/* Kdy je událost hotová.
   Dřív se to poznávalo jen podle čísla v AKTUÁL, jenže spousta událostí
   žádné číslo nemá — projevy, tiskové konference, breaking news, svátky.
   Ty by svítily „doplnit" napořád. Za hotovou proto bereme událost,
   která má číslo NEBO dopad na měnu NEBO vlastní popis místo názvu z kalendáře. */
const jeHotova = (e) =>
  e.aktual !== null ||
  !!(e.verdict && String(e.verdict).trim()) ||
  String(e.info || "").trim().length > KOSTRA_MAX_DELKA;

export function Tyden({ events, onSaved }) {
  // "dnes" se počítá při každém načtení stránky, takže se seznam posouvá sám
  const dnes = new Date().toISOString().slice(0, 10);
  const zaDvaTydny = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10);
  const predTydnem = new Date(Date.now() - 8 * 864e5).toISOString().slice(0, 10);

  // Jen nevyplněné kostry z kalendáře. Vlastnoručně psané záznamy sem nepatří,
  // i když nemají číslo v poli AKTUÁL — text v nich je hotová práce.
  const bezHodnoty = events.filter(
    (e) =>
      e.date &&
      jeKostra(e) &&
      !jeHotova(e) &&
      !NEVYHODNOCUJE_SE.includes(String(e.kategorie || "").toUpperCase())
  );

  // K doplnění: událost už proběhla (nebo je dnes), ale ne dál než týden zpátky.
  const kDoplneni = bezHodnoty
    .filter((e) => e.date.slice(0, 10) <= dnes && e.date.slice(0, 10) >= predTydnem)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // Chystá se: teprve přijde. Jen na přehled, nedá se vyplnit.
  const chystaSe = bezHodnoty
    .filter((e) => e.date.slice(0, 10) > dnes && e.date.slice(0, 10) <= zaDvaTydny)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const poDnech = (list) => {
    const dny = {};
    list.forEach((e) => {
      const d = e.date.slice(0, 10);
      (dny[d] = dny[d] || []).push(e);
    });
    return dny;
  };

  const dnyDoplnit = poDnech(kDoplneni);
  const dnyChysta = poDnech(chystaSe);

  return (
    <>
      <h3 className="sec-title">K doplnění</h3>
      <p className="sub" style={{ marginBottom: 14 }}>
        Události, které už proběhly a čekají na hodnotu. Vyplň a uloží se do stejného
        záznamu v Notionu — novou událost zakládat nemusíš.
      </p>

      {!kDoplneni.length ? (
        <div className="note-box" style={{ textAlign: "left", marginBottom: 26 }}>
          Nic nečeká na doplnění. Všechny proběhlé události mají vyplněnou hodnotu.
        </div>
      ) : (
        Object.keys(dnyDoplnit).sort().reverse().map((d) => (
          <div key={d} style={{ marginBottom: 18 }}>
            <div className="day-head">
              <b>{denVTydnu(d)}</b> {czDate(d)}
              {d === dnes && <span className="day-today">dnes</span>}
            </div>
            {dnyDoplnit[d].map((e) => <PlannedRow key={e.id} ev={e} onSaved={onSaved} />)}
          </div>
        ))
      )}

      {chystaSe.length > 0 && (
        <>
          <h3 className="sec-title" style={{ marginTop: 30 }}>Chystá se</h3>
          <p className="sub" style={{ marginBottom: 14 }}>
            Co teprve přijde. Doplnit půjde až v den, kdy událost proběhne.
          </p>
          {Object.keys(dnyChysta).sort().map((d) => (
            <div key={d} style={{ marginBottom: 16 }}>
              <div className="day-head"><b>{denVTydnu(d)}</b> {czDate(d)}</div>
              {dnyChysta[d].map((e) => <UpcomingRow key={e.id} ev={e} />)}
            </div>
          ))}
        </>
      )}
    </>
  );
}

/* Nadcházející událost — jen k přečtení */
function UpcomingRow({ ev }) {
  return (
    <div className="plan upcoming">
      <div className="plan-head" style={{ cursor: "default" }}>
        <span className="plan-cur">{FLAG[ev.cur] || "◆"} {CUR_NAME[ev.cur] || ev.cur}</span>
        <span className="plan-kat">{ev.kategorie || "bez kategorie"}</span>
        <span className="plan-title">{ev.info}</span>
        {ev.ocekavani !== null && (
          <span className="plan-ocek">oček. {ev.ocekavani}{ev.jednotka ? " " + ev.jednotka : ""}</span>
        )}
        {ev.predchozi !== null && (
          <span className="plan-ocek">předch. {ev.predchozi}</span>
        )}
        {ev.dopad && <span className={"plan-dopad d-" + ev.dopad.replace(/[^a-z]/gi, "")}>{ev.dopad}</span>}
      </div>
    </div>
  );
}

function PlannedRow({ ev, onSaved }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    aktual: "", info: ev.info || "", verdict: ev.verdict || null,
    jednotka: ev.jednotka || "", predchozi: ev.predchozi ?? "",
    ocekavani: ev.ocekavani ?? "",
  });
  const [status, setStatus] = useState({ msg: "", kind: "" });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const a = parseFloat(f.aktual), o = parseFloat(f.ocekavani), p = parseFloat(f.predchozi);
  const surprise = !isNaN(a) && !isNaN(o) ? Math.round((a - o) * 1000) / 1000 : null;
  const zmena = !isNaN(a) && !isNaN(p) ? Math.round((a - p) * 1000) / 1000 : null;

  async function save() {
    // Uložení, které nic nemění, by událost jen nechalo dál svítit „doplnit".
    // Chceme aspoň jednu z věcí, podle kterých se pozná hotová událost.
    const zmenenyPopis = String(f.info || "").trim() !== String(ev.info || "").trim();
    if (f.aktual === "" && !f.verdict && !zmenenyPopis) {
      return setStatus({
        msg: "Zatím není co uložit — doplň hodnotu, dopad na měnu nebo popis.",
        kind: "bad",
      });
    }
    setBusy(true);
    setStatus({ msg: "Ukládám…", kind: "" });
    try {
      const r = await fetch("/api/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ev.id, ...f }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setStatus({ msg: "Uloženo ✓", kind: "ok" });
      onSaved && onSaved();
    } catch (e) {
      setStatus({ msg: "Chyba: " + e.message, kind: "bad" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="plan">
      <button className="plan-head" onClick={() => setOpen(!open)}>
        <span className="plan-arrow">{open ? "▾" : "▸"}</span>
        <span className="plan-cur">{FLAG[ev.cur] || "◆"} {CUR_NAME[ev.cur] || ev.cur}</span>
        <span className="plan-kat">{ev.kategorie || "bez kategorie"}</span>
        {ev.ocekavani !== null && (
          <span className="plan-ocek">oček. {ev.ocekavani}{ev.jednotka ? " " + ev.jednotka : ""}</span>
        )}
        {ev.dopad && <span className={"plan-dopad d-" + ev.dopad.replace(/[^a-z]/gi, "")}>{ev.dopad}</span>}
        <span className="plan-fill">doplnit</span>
      </button>

      {open && (
        <div className="plan-body">
          <div className="fgrid">
            <div className="f"><label>Aktuální hodnota</label>
              <input type="number" step="any" value={f.aktual} autoFocus
                     onChange={(e) => set("aktual", e.target.value)} placeholder="co vyšlo" /></div>
            <div className="f"><label>Jednotka</label>
              <select value={f.jednotka} onChange={(e) => set("jednotka", e.target.value)}>
                <option value="">neuvedeno</option>
                {JEDNOTKY.map((u) => <option key={u} value={u}>{u}</option>)}
              </select></div>
            <div className="f"><label>Očekávání</label>
              <input type="number" step="any" value={f.ocekavani}
                     onChange={(e) => set("ocekavani", e.target.value)} /></div>
            <div className="f"><label>Předchozí</label>
              <input type="number" step="any" value={f.predchozi}
                     onChange={(e) => set("predchozi", e.target.value)} /></div>
            <div className="f wide">
              <label>Dopad na měnu</label>
              <div className="seg">
                {[["+","Pozitivní"],["0","Smíšené"],["-","Negativní"]].map(([v, l]) => (
                  <button key={v} type="button" data-v={v} className={f.verdict === v ? "on" : ""}
                          onClick={() => set("verdict", f.verdict === v ? null : v)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="f wide">
              <div className={"surprise" + (surprise === null || surprise === 0 ? "" : surprise > 0 ? " on-pos" : " on-neg")}>
                {surprise === null ? "Vyplň hodnotu a očekávání — překvapení se dopočítá."
                  : surprise === 0 ? "Přesně podle očekávání."
                  : `Překvapení ${surprise > 0 ? "+" : ""}${surprise} — ${surprise > 0 ? "nad" : "pod"} očekáváním.`}
                {zmena !== null && (
                  <span style={{ marginLeft: 10, color: "var(--ink-3)" }}>
                    Změna proti minule: <b style={{ color: zmena > 0 ? "var(--pos)" : zmena < 0 ? "var(--neg)" : "inherit" }}>
                      {zmena > 0 ? "+" : ""}{zmena}</b>
                  </span>
                )}
              </div>
            </div>
            <div className="f wide">
              <label>Popis</label>
              <textarea value={f.info} onChange={(e) => set("info", e.target.value)}
                        placeholder="Co vyšlo a co to znamená pro měnu." />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={save} disabled={busy}>Uložit do Notionu</button>
            <span className={"status " + status.kind}>{status.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
