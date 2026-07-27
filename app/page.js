"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FLAG, PRIO, REST, KATEGORIE,
  vClass, cClass, vLabel, vSym, czDate, shortDate, filled,
} from "./lib-ui";

export default function Page() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("prehled");
  const [open, setOpen] = useState(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/data", { cache: "no-store" });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const o = data.overview;
    return {
      n: o.length,
      pos: o.filter((r) => r.verdict === "+").length,
      neg: o.filter((r) => r.verdict === "-").length,
      neu: o.filter((r) => r.verdict === "0").length,
      last: o.map((r) => r.updated).filter(Boolean).sort().pop(),
    };
  }, [data]);

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <h1>Fundament — přehled měn</h1>
          <p className="sub">
            {err ? "Data se nepodařilo načíst."
              : !data ? "Načítám z Notionu…"
              : <><b>{stats.n}</b> měn · <b>{stats.pos}</b> pozitivních, <b>{stats.neu}</b> smíšených,{" "}
                  <b>{stats.neg}</b> negativních · aktualizováno <b>{czDate(stats.last)}</b></>}
          </p>
        </div>
        <button className="reload" onClick={load} disabled={busy}>
          {busy ? "Načítám…" : "Obnovit"}
        </button>
      </div>

      {err && (
        <div className="err" style={{ marginTop: 18 }}>
          <b>Chyba:</b> {err}
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink-3)" }}>
            Nejčastější příčina: integrace nemá přístup ke stránkám, nebo chybí NOTION_TOKEN
            v proměnných prostředí. V Notionu otevři OBCHODNÍ DENÍK → ··· → Connections
            a přidej svoji integraci.
          </div>
        </div>
      )}

      {data && (
        <>
          <Strip data={data} onPick={(c) => { setTab("prehled"); setOpen(c); }} />
          <nav className="tabs">
            {[["prehled","Přehled"],["historie","Historie týdnů"],["udalosti","Události"],["zadat","+ Zadat událost"]]
              .map(([k, label]) => (
                <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
              ))}
          </nav>

          {tab === "prehled" && (open
            ? <Detail row={data.overview.find((r) => r.code === open)} onBack={() => setOpen(null)} />
            : <Cards rows={data.overview} onOpen={setOpen} />)}
          {tab === "historie" && <Heat weeks={data.weeks} />}
          {tab === "udalosti" && <Events events={data.events} />}
          {tab === "zadat" && <Form onSaved={load} />}
        </>
      )}

      {!data && !err && <div className="loading" style={{ marginTop: 20 }}>Načítám…</div>}
    </div>
  );
}

function Strip({ data, onPick }) {
  const order = { "+": 0, "0": 1, "-": 2 };
  const rows = [...data.overview].sort((a, b) => (order[a.verdict] ?? 3) - (order[b.verdict] ?? 3));
  return (
    <div className="strip">
      {rows.map((r) => (
        <button key={r.code} className="chip" onClick={() => onPick(r.code)}>
          <span className={"vd " + vClass(r.verdict)}>{vSym(r.verdict)}</span>
          <span>{FLAG[r.code] || ""}</span>{r.code}
        </button>
      ))}
    </div>
  );
}

function Cards({ rows, onOpen }) {
  const order = { "+": 0, "0": 1, "-": 2 };
  const sorted = [...rows].sort((a, b) => {
    const d = (order[a.verdict] ?? 3) - (order[b.verdict] ?? 3);
    return d !== 0 ? d : a.code.localeCompare(b.code);
  });
  const ALL = [...PRIO, ...REST];
  return (
    <div className="grid">
      {sorted.map((r) => {
        const n = ALL.filter((s) => filled(r.sections[s])).length;
        return (
          <button key={r.code} className="card" onClick={() => onOpen(r.code)}>
            <div className="card-top">
              <span className="card-flag">{FLAG[r.code] || "🏳️"}</span>
              <span className="card-code">{r.code}</span>
              <span className={"badge " + vClass(r.verdict)}>{vLabel(r.verdict)}</span>
            </div>
            <div className="card-sum">{r.summary || "Zatím bez shrnutí."}</div>
            <div className="card-foot">
              <span>{czDate(r.updated)}</span><span>·</span>
              <span>{n} z {ALL.length} sekcí</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Detail({ row, onBack }) {
  if (!row) return null;
  const Sec = ({ name, prio }) => {
    const v = row.sections[name];
    const has = filled(v);
    return (
      <div className={"sec" + (prio ? " prio" : "") + (has ? "" : " empty")}>
        <h4>{name}</h4>
        <p>{has ? v : "zatím bez dat"}</p>
      </div>
    );
  };
  return (
    <>
      <div className="detail-head">
        <button className="back" onClick={onBack}>← Zpět</button>
        <span style={{ fontSize: 27 }}>{FLAG[row.code] || "🏳️"}</span>
        <span style={{ fontSize: 23, fontWeight: 660 }}>{row.code}</span>
        <span className={"badge " + vClass(row.verdict)}>{vLabel(row.verdict)}</span>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--ink-3)" }}>
          aktualizováno {czDate(row.updated)}
        </span>
      </div>
      <div className="detail-sum">
        <h3>Shrnutí</h3>
        {row.summary || "Zatím bez shrnutí."}
      </div>
      <div className="sections">{PRIO.map((s) => <Sec key={s} name={s} prio />)}</div>
      <div style={{ height: 14 }} />
      <div className="sections">{REST.map((s) => <Sec key={s} name={s} />)}</div>
    </>
  );
}

function Heat({ weeks }) {
  const dates = [...new Set(weeks.map((w) => (w.date || "").slice(0, 10)).filter(Boolean))]
    .sort().reverse().slice(0, 12).reverse();
  const codes = [...new Set(weeks.map((w) => w.cur).filter(Boolean))].sort();
  const map = {};
  weeks.forEach((w) => {
    if (w.cur && w.date) map[w.cur + "|" + w.date.slice(0, 10)] = w;
  });
  if (!codes.length) return <div className="note-box">Zatím žádné týdenní záznamy.</div>;
  return (
    <>
      <div className="hm-wrap">
        <table className="hm">
          <thead>
            <tr><th className="cur">Měna</th>{dates.map((d) => <th key={d}>{shortDate(d)}</th>)}</tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c}>
                <td className="lbl">{FLAG[c] || ""} {c}</td>
                {dates.map((d) => {
                  const w = map[c + "|" + d];
                  return (
                    <td key={d} className={cClass(w ? w.verdict : null)}
                        title={w ? `${c} — ${shortDate(d)}\n${(w.summary || w.label || "").slice(0, 220)}` : "bez záznamu"}>
                      {vSym(w ? w.verdict : null)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <span><i className="sw" style={{ background: "var(--pos-bg)", border: "1px solid var(--pos-line)" }} /> pozitivní</span>
        <span><i className="sw" style={{ background: "var(--neu-bg)", border: "1px solid var(--neu-line)" }} /> smíšené</span>
        <span><i className="sw" style={{ background: "var(--neg-bg)", border: "1px solid var(--neg-line)" }} /> negativní</span>
        <span><i className="sw" style={{ background: "#faf9f8", border: "1px solid var(--line)" }} /> bez záznamu</span>
      </div>
    </>
  );
}

function Events({ events }) {
  const [f, setF] = useState("*");
  const codes = [...new Set(events.map((e) => e.cur).filter(Boolean))].sort();
  const rows = f === "*" ? events : events.filter((e) => e.cur === f);
  return (
    <>
      <div className="filters">
        <button className={f === "*" ? "on" : ""} onClick={() => setF("*")}>Vše</button>
        {codes.map((c) => (
          <button key={c} className={f === c ? "on" : ""} onClick={() => setF(c)}>{FLAG[c]} {c}</button>
        ))}
      </div>
      {!rows.length && <div className="note-box">Žádné události.</div>}
      {rows.map((e, i) => (
        <div className="ev" key={i}>
          <div className="ev-rail">
            <span className="ev-date">{shortDate(e.date)}</span>
            <span className={"ev-badge " + vClass(e.verdict)}>{vSym(e.verdict)}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ev-cur">
              {FLAG[e.cur] || ""} {e.cur || "—"}
              {e.kategorie ? <span style={{ color: "var(--ink-3)", fontWeight: 500 }}> · {e.kategorie}</span> : null}
              {e.dopad ? <span style={{ color: "var(--ink-3)", fontWeight: 500 }}> · dopad {e.dopad}</span> : null}
            </div>
            <div className="ev-txt">{e.info || "bez popisu"}</div>
            {(e.aktual !== null || e.ocekavani !== null) && (
              <div className="ev-nums">
                {e.aktual !== null && <span>aktuál <b>{e.aktual}</b></span>}
                {e.ocekavani !== null && <span>oček. <b>{e.ocekavani}</b></span>}
                {e.predchozi !== null && <span>předch. <b>{e.predchozi}</b></span>}
                {e.prekvapeni !== null && e.prekvapeni !== 0 && (
                  <span className={"pill " + (e.prekvapeni > 0 ? "up" : "down")}>
                    {e.prekvapeni > 0 ? "+" : ""}{e.prekvapeni}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

function Form({ onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    cur: "EUR", date: today, kategorie: "", dopad: "",
    aktual: "", ocekavani: "", predchozi: "", info: "", verdict: null,
  });
  const [status, setStatus] = useState({ msg: "", kind: "" });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const a = parseFloat(f.aktual), o = parseFloat(f.ocekavani);
  const surprise = !isNaN(a) && !isNaN(o) ? Math.round((a - o) * 1000) / 1000 : null;

  async function save() {
    if (!f.info.trim()) return setStatus({ msg: "Doplň popis události.", kind: "bad" });
    setBusy(true);
    setStatus({ msg: "Ukládám…", kind: "" });
    try {
      const r = await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setStatus({ msg: `Uloženo do ${f.cur} ✓`, kind: "ok" });
      setF({ ...f, aktual: "", ocekavani: "", predchozi: "", info: "", verdict: null, kategorie: "", dopad: "" });
      onSaved && onSaved();
    } catch (e) {
      setStatus({ msg: "Nepodařilo se uložit: " + e.message, kind: "bad" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form">
      <h2>Nová událost do FUNDAMENTU</h2>
      <p className="hint">Uloží se rovnou do Notionu. Sobotní úloha ji pak promítne do týdenního i celkového přehledu.</p>
      <div className="fgrid">
        <div className="f">
          <label>Měna</label>
          <select value={f.cur} onChange={(e) => set("cur", e.target.value)}>
            {Object.keys(FLAG).map((c) => <option key={c} value={c}>{FLAG[c]} {c}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Datum</label>
          <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="f">
          <label>Kategorie</label>
          <select value={f.kategorie} onChange={(e) => set("kategorie", e.target.value)}>
            <option value="">neuvedeno</option>
            {KATEGORIE.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Síla dopadu</label>
          <select value={f.dopad} onChange={(e) => set("dopad", e.target.value)}>
            <option value="">neuvedeno</option>
            <option value="vysoký">vysoký</option>
            <option value="střední">střední</option>
            <option value="nízký">nízký</option>
          </select>
        </div>
        <div className="f"><label>Aktuál</label>
          <input type="number" step="any" value={f.aktual} onChange={(e) => set("aktual", e.target.value)} placeholder="např. 2.6" /></div>
        <div className="f"><label>Očekávání</label>
          <input type="number" step="any" value={f.ocekavani} onChange={(e) => set("ocekavani", e.target.value)} placeholder="např. 2.8" /></div>
        <div className="f"><label>Předchozí</label>
          <input type="number" step="any" value={f.predchozi} onChange={(e) => set("predchozi", e.target.value)} placeholder="např. 3.2" /></div>
        <div className="f">
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
            {surprise === null ? "Vyplň aktuál a očekávání — překvapení se dopočítá."
              : surprise === 0 ? "Přesně podle očekávání — překvapení 0."
              : `Překvapení ${surprise > 0 ? "+" : ""}${surprise} — ${surprise > 0 ? "nad" : "pod"} očekáváním.`}
          </div>
        </div>
        <div className="f wide">
          <label>Popis události</label>
          <textarea value={f.info} onChange={(e) => set("info", e.target.value)}
                    placeholder="Co vyšlo, jak to dopadlo proti očekávání a co to znamená pro měnu." />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn-primary" onClick={save} disabled={busy}>Uložit do Notionu</button>
        <button className="btn-ghost" onClick={() => { setF({ ...f, aktual: "", ocekavani: "", predchozi: "", info: "", verdict: null }); setStatus({ msg: "", kind: "" }); }}>Vyčistit</button>
        <span className={"status " + status.kind}>{status.msg}</span>
      </div>
    </div>
  );
}
