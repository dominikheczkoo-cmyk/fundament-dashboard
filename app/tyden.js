"use client";

import { useState } from "react";
import { FLAG, CUR_NAME, JEDNOTKY, czDate, denVTydnu, filled } from "./lib-ui";

/* Naplánované události — ty, které ještě nemají vyplněnou aktuální hodnotu.
   Doplníš je rovnou tady a uloží se zpátky do Notionu. */
export function Tyden({ events, onSaved }) {
  const dnes = new Date().toISOString().slice(0, 10);
  const zaMesic = new Date(Date.now() + 31 * 864e5).toISOString().slice(0, 10);
  const predTydnem = new Date(Date.now() - 8 * 864e5).toISOString().slice(0, 10);

  const planned = events
    .filter((e) => e.aktual === null && e.date && e.date.slice(0, 10) >= predTydnem && e.date.slice(0, 10) <= zaMesic)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (!planned.length) {
    return (
      <div className="note-box" style={{ textAlign: "left" }}>
        Žádné naplánované události k doplnění. Jakmile ti do FUNDAMENTU přibudou záznamy
        bez vyplněné aktuální hodnoty, objeví se tady i s formulářem na doplnění.
      </div>
    );
  }

  const dny = {};
  planned.forEach((e) => {
    const d = e.date.slice(0, 10);
    (dny[d] = dny[d] || []).push(e);
  });

  return (
    <>
      <p className="sub" style={{ marginBottom: 14 }}>
        Události, které čekají na doplnění. Vyplň aktuální hodnotu a popis — uloží se rovnou do Notionu.
      </p>
      {Object.keys(dny).sort().map((d) => (
        <div key={d} style={{ marginBottom: 18 }}>
          <div className="day-head">
            <b>{denVTydnu(d)}</b> {czDate(d)}
            {d < dnes && <span className="day-past">už proběhlo</span>}
          </div>
          {dny[d].map((e) => <PlannedRow key={e.id} ev={e} onSaved={onSaved} />)}
        </div>
      ))}
    </>
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
    if (f.aktual === "" && !filled(f.info)) {
      return setStatus({ msg: "Doplň aspoň hodnotu nebo popis.", kind: "bad" });
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
