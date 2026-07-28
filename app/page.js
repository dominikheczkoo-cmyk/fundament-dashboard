"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  FLAG, PRIO, REST, KATEGORIE,
  vClass, cClass, vLabel, vSym, czDate, shortDate, filled,
} from "./lib-ui";
import { LineChart, BarChart, fmt } from "./chart";

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
            {[["prehled","Přehled"],["grafy","Grafy"],["sazby","Sazby a sentiment"],["historie","Historie týdnů"],["udalosti","Události"],["zadat","+ Zadat"]]
              .map(([k, label]) => (
                <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
              ))}
          </nav>

          {tab === "prehled" && (open
            ? <Detail row={data.overview.find((r) => r.code === open)}
                      rate={latestPerCur(data.rates || []).find((r) => r.cur === open)}
                      pos={latestPerCur(data.positions || []).find((r) => r.cur === open)}
                      onBack={() => setOpen(null)} />
            : <Cards rows={data.overview} onOpen={setOpen} />)}
          {tab === "grafy" && <Charts events={data.events} rates={data.rates || []} positions={data.positions || []} />}
          {tab === "sazby" && <Rates rates={data.rates || []} positions={data.positions || []} />}
          {tab === "historie" && <Heat weeks={data.weeks} />}
          {tab === "udalosti" && <Events events={data.events} />}
          {tab === "zadat" && <AddArea onSaved={load} />}
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

const pct = (n) => (n === null || n === undefined ? "—" : (n * 100).toFixed(2).replace(".", ",") + " %");
const num = (n) => (n === null || n === undefined ? "—" : n.toLocaleString("cs-CZ"));

// z více záznamů na měnu nech jen ten nejnovější
export function latestPerCur(rows) {
  const best = {};
  rows.forEach((r) => {
    if (!r.cur) return;
    const cur = best[r.cur];
    if (!cur || String(r.date || "") > String(cur.date || "")) best[r.cur] = r;
  });
  return Object.values(best);
}

function Rates({ rates, positions }) {
  const [openRow, setOpenRow] = useState(null);
  const sorted = latestPerCur(rates).sort((a, b) => (b.ocekavani ?? -9) - (a.ocekavani ?? -9));
  const posLatest = latestPerCur(positions);
  const posSorted = [...posLatest].sort((a, b) => (b.spread ?? -1e9) - (a.spread ?? -1e9));
  const sentDate = posLatest.map((p) => p.date).filter(Boolean).sort().pop();

  return (
    <>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 640 }}>Úrokové sazby</h3>
      <p className="sub" style={{ marginBottom: 12 }}>
        Seřazeno od nejvyšší sazby. Rozdíl mezi dvěma měnami je to, co žene jejich pár.
      </p>
      <div className="hm-wrap" style={{ padding: 0, overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Měna</th>
              <th>Očekávání</th><th>Předchozí</th><th>Změna</th>
              <th>Šance</th><th>Do konce roku</th><th>Zasedání</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isOpen = openRow === r.cur;
              const hasDetail = filled(r.duvod) || filled(r.pocetSnizeni);
              return (
                <React.Fragment key={r.cur}>
                  <tr onClick={() => setOpenRow(isOpen ? null : r.cur)} style={{ cursor: "pointer" }}>
                    <td style={{ textAlign: "left", fontWeight: 600 }}>
                      <span style={{ color: "var(--ink-3)", marginRight: 5, fontSize: 11 }}>
                        {isOpen ? "▾" : "▸"}
                      </span>
                      {FLAG[r.cur] || ""} {r.cur}
                    </td>
                    <td style={{ fontWeight: 650 }}>{pct(r.ocekavani)}</td>
                    <td style={{ color: "var(--ink-3)" }}>{pct(r.predchozi)}</td>
                    <td>
                      {r.zmena === null || r.zmena === 0
                        ? <span style={{ color: "var(--ink-3)" }}>beze změny</span>
                        : <span className={"pill " + (r.zmena > 0 ? "up" : "down")}>
                            {r.zmena > 0 ? "+" : ""}{Math.round(r.zmena * 10000)} bps
                          </span>}
                    </td>
                    <td>{r.sance === null ? "—" : Math.round(r.sance * 100) + " %"}</td>
                    <td style={{ color: "var(--ink-2)" }}>{r.doKonceRoku || "—"}</td>
                    <td style={{ color: "var(--ink-3)", fontSize: 12.5 }}>{czDate(r.date)}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "left", background: "#fcfcfb", padding: "14px 16px" }}>
                        {filled(r.pocetSnizeni) && (
                          <div style={{ fontSize: 13, marginBottom: filled(r.duvod) ? 9 : 0 }}>
                            <b style={{ color: "var(--ink-3)", fontWeight: 620 }}>Počet ročních snížení: </b>
                            {r.pocetSnizeni}
                          </div>
                        )}
                        {filled(r.duvod) ? (
                          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>
                            {r.duvod}
                          </div>
                        ) : !filled(r.pocetSnizeni) ? (
                          <div style={{ fontSize: 13, color: "var(--none)", fontStyle: "italic" }}>
                            Zatím bez poznámky. Doplnit ji můžeš v záložce „+ Zadat" nebo přímo v Notionu.
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <RateMatrix rates={rates} />

      <h3 style={{ margin: "26px 0 4px", fontSize: 16, fontWeight: 640 }}>Sentiment trhu</h3>
      <p className="sub" style={{ marginBottom: 12 }}>
        Poziční data. Seřazeno podle spreadu.{sentDate ? ` Data k ${czDate(sentDate)}.` : ""}
      </p>
      <div className="hm-wrap" style={{ padding: 0, overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Instrument</th>
              <th>Long</th><th>Short</th><th>Spread</th><th>Krátkodobě</th>
            </tr>
          </thead>
          <tbody>
            {posSorted.map((p) => (
              <tr key={p.cur}>
                <td style={{ textAlign: "left", fontWeight: 600 }}>{FLAG[p.cur] || "◆"} {p.cur}</td>
                <td className={p.long < 0 ? "neg-num" : ""}>{num(p.long)}</td>
                <td>{num(p.short)}</td>
                <td className={p.spread < 0 ? "neg-num" : ""} style={{ fontWeight: 650 }}>{num(p.spread)}</td>
                <td>
                  {p.shortTerm
                    ? <span className={"pill " + (p.shortTerm === "Bullish" ? "up" : "down")}>{p.shortTerm}</span>
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- matice rozdílů sazeb ---------- */
function RateMatrix({ rates }) {
  const rows = latestPerCur(rates)
    .filter((r) => r.ocekavani !== null && FLAG[r.cur])
    .sort((a, b) => b.ocekavani - a.ocekavani);
  if (rows.length < 2) return null;
  return (
    <>
      <h3 style={{ margin: "26px 0 4px", fontSize: 16, fontWeight: 640 }}>Rozdíly sazeb mezi měnami</h3>
      <p className="sub" style={{ marginBottom: 12 }}>
        Kolik procentních bodů má měna v řádku navíc oproti měně ve sloupci. Kladné číslo znamená,
        že řádková měna nese vyšší úrok.
      </p>
      <div className="hm-wrap" style={{ padding: 0, overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}></th>
              {rows.map((c) => <th key={c.cur}>{c.cur}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cur}>
                <td style={{ textAlign: "left", fontWeight: 640 }}>{FLAG[r.cur]} {r.cur}</td>
                {rows.map((c) => {
                  if (c.cur === r.cur) return <td key={c.cur} style={{ background: "#f7f6f4", color: "var(--none)" }}>—</td>;
                  const d = (r.ocekavani - c.ocekavani) * 100;
                  const strong = Math.abs(d) >= 2;
                  return (
                    <td key={c.cur} style={{
                      color: d > 0 ? "var(--pos)" : d < 0 ? "var(--neg)" : "var(--ink-3)",
                      fontWeight: strong ? 680 : 500,
                      background: strong ? (d > 0 ? "var(--pos-bg)" : "var(--neg-bg)") : "transparent",
                    }}>
                      {d > 0 ? "+" : ""}{d.toFixed(2).replace(".", ",")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- záložka Grafy ---------- */
const CHART_GROUPS = [
  { key: "CPI", label: "Inflace", cats: ["CPI", "PPI"] },
  { key: "PRACE", label: "Trh práce", cats: ["NFP", "Jobless Claims"] },
  { key: "SAZBY", label: "Sazby", cats: ["Sazby"] },
  { key: "RUST", label: "Růst", cats: ["HDP", "PMI", "Retail Sales"] },
];

function Charts({ events, rates, positions }) {
  const curs = Object.keys(FLAG);
  const [cur, setCur] = useState("EUR");

  const mine = events.filter((e) => e.cur === cur);
  const byCat = (cats) => {
    const rows = mine
      .filter((e) => cats.includes(e.kategorie) && e.aktual !== null)
      .map((e) => ({ date: e.obdobi || e.date, value: e.aktual, expected: e.ocekavani, jednotka: e.jednotka, kat: e.kategorie }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return rows;
  };

  const surprises = mine
    .filter((e) => e.prekvapeni !== null)
    .map((e) => ({ date: e.obdobi || e.date, value: e.prekvapeni }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const rateHist = [...rates].filter((r) => r.cur === cur && r.ocekavani !== null)
    .map((r) => ({ date: r.date, value: r.ocekavani * 100 }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const posHist = [...positions].filter((p) => p.cur === cur && p.spread !== null)
    .map((p) => ({ date: p.date, value: p.spread }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const anyData = CHART_GROUPS.some((g) => byCat(g.cats).length > 0) || rateHist.length > 0 || posHist.length > 0;

  return (
    <>
      <div className="picker">
        <span className="lbl">Měna:</span>
        {curs.map((c) => (
          <button key={c} className={"chip" + (cur === c ? " on" : "")} onClick={() => setCur(c)}
                  style={cur === c ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : {}}>
            {FLAG[c]} {c}
          </button>
        ))}
      </div>

      {!anyData && (
        <div className="note-box" style={{ marginBottom: 14, textAlign: "left" }}>
          U <b>{cur}</b> zatím nejsou žádná čísla. Grafy se naplní, jakmile začneš u událostí vyplňovat
          <b> kategorii</b> a <b>aktuální hodnotu</b>. Každý nový zápis přidá jeden bod.
        </div>
      )}

      {CHART_GROUPS.map((g) => {
        const rows = byCat(g.cats);
        if (!rows.length) return null;
        const unit = rows[rows.length - 1].jednotka || "";
        return (
          <div className="chart-card" key={g.key}>
            <h4>{g.label}</h4>
            <p className="cap">{[...new Set(rows.map((r) => r.kat))].join(", ")} · {rows.length} {rows.length === 1 ? "hodnota" : "hodnot"}</p>
            <LineChart series={rows} unit={unit} showExpected />
          </div>
        );
      })}

      {rateHist.length > 0 && (
        <div className="chart-card">
          <h4>Očekávaná úroková sazba</h4>
          <p className="cap">Jak se posouvalo očekávání sazby pro {cur}</p>
          <LineChart series={rateHist} unit="%" />
        </div>
      )}

      {posHist.length > 0 && (
        <div className="chart-card">
          <h4>Sentiment — spread</h4>
          <p className="cap">Poziční data po týdnech</p>
          <LineChart series={posHist} />
        </div>
      )}

      {surprises.length > 0 && (
        <div className="chart-card">
          <h4>Překvapení proti očekávání</h4>
          <p className="cap">Kladné znamená, že data překonala odhad. Zelená série napovídá o síle ekonomiky víc než jednotlivé číslo.</p>
          <BarChart series={surprises} />
        </div>
      )}
    </>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div className="mini">
      <span className="mini-l">{label}</span>
      <span className={"mini-v" + (tone ? " " + tone : "")}>{value}</span>
    </div>
  );
}

function Detail({ row, rate, pos, onBack }) {
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
      {(rate || pos) && (
        <div className="minirow">
          {rate && <MiniStat label="Sazba" value={pct(rate.ocekavani)} />}
          {rate && rate.zmena !== null && rate.zmena !== 0 &&
            <MiniStat label="Změna" value={`${rate.zmena > 0 ? "+" : ""}${Math.round(rate.zmena * 10000)} bps`}
                      tone={rate.zmena > 0 ? "up" : "down"} />}
          {rate && rate.sance !== null && <MiniStat label="Šance" value={Math.round(rate.sance * 100) + " %"} />}
          {rate && rate.doKonceRoku && <MiniStat label="Do konce roku" value={rate.doKonceRoku} />}
          {pos && pos.spread !== null && <MiniStat label="Spread" value={num(pos.spread)}
                      tone={pos.spread > 0 ? "up" : "down"} />}
          {pos && pos.shortTerm && <MiniStat label="Sentiment" value={pos.shortTerm}
                      tone={pos.shortTerm === "Bullish" ? "up" : "down"} />}
        </div>
      )}
      {rate && filled(rate.duvod) && (
        <div className="detail-sum" style={{ marginBottom: 12 }}>
          <h3>Poznámka k sazbám</h3>
          {rate.duvod}
          {filled(rate.pocetSnizeni) && (
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-3)" }}>
              Počet ročních snížení: <b style={{ color: "var(--ink-2)" }}>{rate.pocetSnizeni}</b>
            </div>
          )}
        </div>
      )}
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

function AddArea({ onSaved }) {
  const [which, setWhich] = useState("event");
  return (
    <>
      <div className="filters" style={{ marginBottom: 16 }}>
        {[["event","Událost"],["rate","Úrokové sazby"],["sentiment","Sentiment trhu"]].map(([k, l]) => (
          <button key={k} className={which === k ? "on" : ""} onClick={() => setWhich(k)}>{l}</button>
        ))}
      </div>
      {which === "event" && <Form onSaved={onSaved} />}
      {which === "rate" && <RateForm onSaved={onSaved} />}
      {which === "sentiment" && <SentimentForm onSaved={onSaved} />}
    </>
  );
}

function ModeSwitch({ mode, setMode }) {
  return (
    <div className="f wide">
      <label>Způsob zápisu</label>
      <div className="seg">
        <button type="button" className={mode === "update" ? "on" : ""}
                data-v={mode === "update" ? "0" : ""}
                onClick={() => setMode("update")}>Přepsat stávající</button>
        <button type="button" className={mode === "create" ? "on" : ""}
                data-v={mode === "create" ? "0" : ""}
                onClick={() => setMode("create")}>Přidat nový řádek</button>
      </div>
      <p className="hint" style={{ margin: "7px 0 0", fontSize: 12.5 }}>
        {mode === "update"
          ? "Najde poslední záznam téhle měny a přepíše ho. Databáze zůstane čistá — jeden řádek na měnu."
          : "Založí další záznam. V tabulce uvidíš vždy nejnovější, ale buduje se ti historie pro pozdější grafy."}
      </p>
    </div>
  );
}

function useSaver(onSaved) {
  const [status, setStatus] = useState({ msg: "", kind: "" });
  const [busy, setBusy] = useState(false);
  async function send(payload, okMsg, reset) {
    setBusy(true);
    setStatus({ msg: "Ukládám…", kind: "" });
    try {
      const r = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setStatus({ msg: okMsg, kind: "ok" });
      reset && reset();
      onSaved && onSaved();
    } catch (e) {
      setStatus({ msg: "Nepodařilo se uložit: " + e.message, kind: "bad" });
    } finally {
      setBusy(false);
    }
  }
  return { status, busy, send, setStatus };
}

function RateForm({ onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    cur: "EUR", date: today, ocekavani: "", predchozi: "",
    sance: "", doKonceRoku: "", pocetSnizeni: "", duvod: "",
  });
  const [mode, setMode] = useState("update");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const { status, busy, send } = useSaver(onSaved);

  const o = parseFloat(f.ocekavani), p = parseFloat(f.predchozi);
  const bps = !isNaN(o) && !isNaN(p) ? Math.round((o - p) * 100) : null;

  return (
    <div className="form">
      <h2>Nový záznam o sazbách</h2>
      <p className="hint">
        Sazby zadávej v procentech, tedy <b>3,75</b> pro 3,75 %. Šanci taky v procentech, tedy <b>99</b> pro 99 %.
        Každý nový záznam se přidá jako další řádek, takže ti vzniká historie — v tabulce se vždy ukáže ten nejnovější.
      </p>
      <div className="fgrid">
        <div className="f">
          <label>Měna</label>
          <select value={f.cur} onChange={(e) => set("cur", e.target.value)}>
            {Object.keys(FLAG).map((c) => <option key={c} value={c}>{FLAG[c]} {c}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Datum zasedání</label>
          <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="f"><label>Očekávaná sazba (%)</label>
          <input type="number" step="any" value={f.ocekavani} onChange={(e) => set("ocekavani", e.target.value)} placeholder="3.75" /></div>
        <div className="f"><label>Předchozí sazba (%)</label>
          <input type="number" step="any" value={f.predchozi} onChange={(e) => set("predchozi", e.target.value)} placeholder="3.75" /></div>
        <div className="f"><label>Procentní šance (%)</label>
          <input type="number" step="any" value={f.sance} onChange={(e) => set("sance", e.target.value)} placeholder="99" /></div>
        <div className="f"><label>Výhled do konce roku</label>
          <input type="text" value={f.doKonceRoku} onChange={(e) => set("doKonceRoku", e.target.value)} placeholder="20 bps up" /></div>
        <div className="f"><label>Počet ročních snížení</label>
          <input type="text" value={f.pocetSnizeni} onChange={(e) => set("pocetSnizeni", e.target.value)} placeholder="např. 2" /></div>
        <div className="f wide">
          <div className={"surprise" + (bps === null || bps === 0 ? "" : bps > 0 ? " on-pos" : " on-neg")}>
            {bps === null ? "Vyplň očekávanou a předchozí sazbu — změna se dopočítá."
              : bps === 0 ? "Beze změny sazby."
              : `Změna ${bps > 0 ? "+" : ""}${bps} bps — ${bps > 0 ? "zvýšení" : "snížení"}.`}
          </div>
        </div>
        <div className="f wide">
          <label>Důvod změny a poznámka</label>
          <textarea value={f.duvod} onChange={(e) => set("duvod", e.target.value)}
                    placeholder="Proč banka rozhodla takhle a co z toho plyne." />
        </div>
        <ModeSwitch mode={mode} setMode={setMode} />
      </div>
      <div className="form-actions">
        <button className="btn-primary" onClick={() => send({ kind: "rate", mode, ...f },
          mode === "update" ? `Sazby pro ${f.cur} přepsány ✓` : `Sazby pro ${f.cur} přidány ✓`,
          () => setF({ ...f, ocekavani: "", predchozi: "", sance: "", doKonceRoku: "", pocetSnizeni: "", duvod: "" }))} disabled={busy}>
          {mode === "update" ? "Přepsat v Notionu" : "Přidat do Notionu"}
        </button>
        <span className={"status " + status.kind}>{status.msg}</span>
      </div>
    </div>
  );
}

function SentimentForm({ onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const INSTR = [...Object.keys(FLAG), "XAU", "XAG", "Indexy"];
  const [f, setF] = useState({
    cur: "EUR", date: today, long: "", short: "", spread: "",
    shortTerm: "", longTerm: "",
  });
  const [mode, setMode] = useState("update");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const { status, busy, send } = useSaver(onSaved);

  return (
    <div className="form">
      <h2>Nový záznam sentimentu</h2>
      <p className="hint">
        Poziční data. Záporná čísla piš s minusem, oddělovače tisíců řešit nemusíš.
        Každý zápis přidá další řádek, takže se ti buduje historie.
      </p>
      <div className="fgrid">
        <div className="f">
          <label>Instrument</label>
          <select value={f.cur} onChange={(e) => set("cur", e.target.value)}>
            {INSTR.map((c) => <option key={c} value={c}>{FLAG[c] ? FLAG[c] + " " : "◆ "}{c}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Datum</label>
          <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="f"><label>Long</label>
          <input type="number" step="any" value={f.long} onChange={(e) => set("long", e.target.value)} placeholder="-11530" /></div>
        <div className="f"><label>Short</label>
          <input type="number" step="any" value={f.short} onChange={(e) => set("short", e.target.value)} placeholder="9718" /></div>
        <div className="f"><label>Spread</label>
          <input type="number" step="any" value={f.spread} onChange={(e) => set("spread", e.target.value)} placeholder="-5203" /></div>
        <div className="f">
          <label>Krátkodobý výsledek</label>
          <div className="seg">
            {["Bullish","Bearish"].map((v) => (
              <button key={v} type="button" data-v={v === "Bullish" ? "+" : "-"}
                      className={f.shortTerm === v ? "on" : ""}
                      onClick={() => set("shortTerm", f.shortTerm === v ? "" : v)}>{v}</button>
            ))}
          </div>
        </div>
        <div className="f wide">
          <label>Dlouhodobý výsledek</label>
          <div className="seg" style={{ maxWidth: 320 }}>
            {["Bullish","Bearish"].map((v) => (
              <button key={v} type="button" data-v={v === "Bullish" ? "+" : "-"}
                      className={f.longTerm === v ? "on" : ""}
                      onClick={() => set("longTerm", f.longTerm === v ? "" : v)}>{v}</button>
            ))}
          </div>
        </div>
        <ModeSwitch mode={mode} setMode={setMode} />
      </div>
      <div className="form-actions">
        <button className="btn-primary" onClick={() => send({ kind: "sentiment", mode, ...f },
          mode === "update" ? `Sentiment pro ${f.cur} přepsán ✓` : `Sentiment pro ${f.cur} přidán ✓`,
          () => setF({ ...f, long: "", short: "", spread: "", shortTerm: "", longTerm: "" }))} disabled={busy}>
          {mode === "update" ? "Přepsat v Notionu" : "Přidat do Notionu"}
        </button>
        <span className={"status " + status.kind}>{status.msg}</span>
      </div>
    </div>
  );
}

function Form({ onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    cur: "EUR", date: today, obdobi: "", kategorie: "", dopad: "", jednotka: "",
    aktual: "", ocekavani: "", predchozi: "", info: "", verdict: null,
  });
  const [status, setStatus] = useState({ msg: "", kind: "" });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const a = parseFloat(f.aktual), o = parseFloat(f.ocekavani), pr = parseFloat(f.predchozi);
  const surprise = !isNaN(a) && !isNaN(o) ? Math.round((a - o) * 1000) / 1000 : null;
  const zmena = !isNaN(a) && !isNaN(pr) ? Math.round((a - pr) * 1000) / 1000 : null;

  async function save() {
    if (!f.info.trim()) return setStatus({ msg: "Doplň popis události.", kind: "bad" });
    if (!f.kategorie) return setStatus({ msg: "Vyber kategorii — bez ní se událost nedostane do grafů.", kind: "bad" });
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
          <label>Datum zveřejnění</label>
          <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="f">
          <label>Kategorie — povinná</label>
          <select value={f.kategorie} onChange={(e) => set("kategorie", e.target.value)}
                  style={!f.kategorie ? { borderColor: "var(--neu-line)", background: "var(--neu-bg)" } : {}}>
            <option value="">vyber…</option>
            {KATEGORIE.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Za období</label>
          <input type="date" value={f.obdobi} onChange={(e) => set("obdobi", e.target.value)} />
        </div>
        <div className="f">
          <label>Jednotka</label>
          <select value={f.jednotka} onChange={(e) => set("jednotka", e.target.value)}>
            <option value="">neuvedeno</option>
            {["%", "tis.", "mld.", "index", "bps", "jiné"].map((u) => <option key={u} value={u}>{u}</option>)}
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
            {zmena !== null && (
              <span style={{ marginLeft: 10, color: "var(--ink-3)" }}>
                Změna proti minulé hodnotě: <b style={{ color: zmena > 0 ? "var(--pos)" : zmena < 0 ? "var(--neg)" : "inherit" }}>
                  {zmena > 0 ? "+" : ""}{zmena}
                </b>
              </span>
            )}
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
