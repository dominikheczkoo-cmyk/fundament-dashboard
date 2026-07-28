"use client";

import { shortDate } from "./lib-ui";

/* Jednoduchý spojnicový graf. Vlastní SVG — žádná knihovna,
   takže se nemá co rozbít při aktualizaci závislostí. */
export function LineChart({ series, height = 210, unit = "", showExpected = false }) {
  // series: [{ date, value, expected }]
  const pts = series.filter((p) => p.value !== null && p.value !== undefined);
  if (pts.length === 0) {
    return <div className="chart-empty">Zatím žádná čísla — graf naskočí, jakmile začneš vyplňovat hodnoty.</div>;
  }
  if (pts.length === 1) {
    const p = pts[0];
    return (
      <div className="chart-single">
        <div className="chart-single-v">{fmt(p.value)}{unit ? " " + unit : ""}</div>
        <div className="chart-single-d">{shortDate(p.date)} — zatím jediný bod, na trend potřebuješ aspoň dva</div>
      </div>
    );
  }

  const W = 720, H = height, PL = 46, PR = 14, PT = 14, PB = 26;
  const iw = W - PL - PR, ih = H - PT - PB;

  const vals = pts.map((p) => p.value);
  if (showExpected) pts.forEach((p) => { if (p.expected !== null && p.expected !== undefined) vals.push(p.expected); });
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15;
  lo -= pad; hi += pad;

  const x = (i) => PL + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const y = (v) => PT + ih - ((v - lo) / (hi - lo)) * ih;

  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(pts.length - 1).toFixed(1)},${(PT + ih).toFixed(1)} L${x(0).toFixed(1)},${(PT + ih).toFixed(1)} Z`;

  const expPts = showExpected ? pts.filter((p) => p.expected !== null && p.expected !== undefined) : [];
  const expPath = expPts.length > 1
    ? expPts.map((p, i) => {
        const idx = pts.indexOf(p);
        return `${i ? "L" : "M"}${x(idx).toFixed(1)},${y(p.expected).toFixed(1)}`;
      }).join(" ")
    : null;

  const ticks = [lo + (hi - lo) * 0.05, (lo + hi) / 2, hi - (hi - lo) * 0.05];
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const delta = Math.round((last.value - prev.value) * 1000) / 1000;

  return (
    <div>
      <div className="chart-head">
        <span className="chart-last">{fmt(last.value)}{unit ? " " + unit : ""}</span>
        <span className={"pill " + (delta > 0 ? "up" : delta < 0 ? "down" : "")}>
          {delta > 0 ? "+" : ""}{fmt(delta)} oproti minule
        </span>
        <span className="chart-date">k {shortDate(last.date)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PL - 8} y={y(t) + 4} className="axis" textAnchor="end">{fmt(t)}</text>
          </g>
        ))}
        <path d={area} className="area" />
        {expPath && <path d={expPath} className="line-exp" />}
        <path d={path} className="line" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r="3.5" className="dot" />
            <title>{`${shortDate(p.date)}: ${fmt(p.value)}${unit ? " " + unit : ""}${
              p.expected !== null && p.expected !== undefined ? ` (oček. ${fmt(p.expected)})` : ""}`}</title>
          </g>
        ))}
        {pts.map((p, i) =>
          (i === 0 || i === pts.length - 1 || pts.length <= 6) ? (
            <text key={"l" + i} x={x(i)} y={H - 8} className="axis" textAnchor="middle">{shortDate(p.date)}</text>
          ) : null
        )}
      </svg>
      {showExpected && expPts.length > 1 && (
        <div className="chart-legend">
          <span><i className="ln solid" /> skutečnost</span>
          <span><i className="ln dash" /> očekávání</span>
        </div>
      )}
    </div>
  );
}

/* Sloupcový graf pro překvapení — kladné zelené, záporné červené */
export function BarChart({ series, height = 180, unit = "" }) {
  const pts = series.filter((p) => p.value !== null && p.value !== undefined);
  if (!pts.length) {
    return <div className="chart-empty">Zatím žádná data.</div>;
  }
  const W = 720, H = height, PL = 46, PR = 14, PT = 14, PB = 26;
  const iw = W - PL - PR, ih = H - PT - PB;
  const max = Math.max(...pts.map((p) => Math.abs(p.value))) || 1;
  const y0 = PT + ih / 2;
  const bw = Math.min(38, (iw / pts.length) * 0.62);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
        <line x1={PL} x2={W - PR} y1={y0} y2={y0} className="grid" />
        <text x={PL - 8} y={y0 + 4} className="axis" textAnchor="end">0</text>
        {pts.map((p, i) => {
          const cx = PL + ((i + 0.5) / pts.length) * iw;
          const h = (Math.abs(p.value) / max) * (ih / 2 - 4);
          const up = p.value >= 0;
          return (
            <g key={i}>
              <rect x={cx - bw / 2} y={up ? y0 - h : y0} width={bw} height={Math.max(h, 1)}
                    rx="3" className={up ? "bar-up" : "bar-down"} />
              <title>{`${shortDate(p.date)}: ${p.value > 0 ? "+" : ""}${fmt(p.value)}${unit ? " " + unit : ""}`}</title>
            </g>
          );
        })}
        {pts.map((p, i) =>
          (i === 0 || i === pts.length - 1 || pts.length <= 8) ? (
            <text key={"l" + i} x={PL + ((i + 0.5) / pts.length) * iw} y={H - 8}
                  className="axis" textAnchor="middle">{shortDate(p.date)}</text>
          ) : null
        )}
      </svg>
    </div>
  );
}

export function fmt(n) {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  const d = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return n.toLocaleString("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: d });
}
