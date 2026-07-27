export const FLAG = {
  EUR: "🇪🇺", USD: "🇺🇸", GBP: "🇬🇧", JPY: "🇯🇵",
  CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿", CHF: "🇨🇭",
};

export const PRIO = [
  "SAZBY", "PRESS CONFERENCE", "CPI", "NEZAMĚSTNANOST",
  "ZAMĚSTNANOST", "BREAKING NEWS", "PROJEVY",
];
export const REST = [
  "PCE", "PPI", "NFP", "JOBLESS CLAIMS", "JOLTS",
  "PMI", "HDP", "RETAIL SALES", "SPOTŘEBITELSKÁ DŮVĚRA", "NEMOVITOSTI",
];

export const KATEGORIE = [
  "Sazby", "CPI", "PPI", "PMI", "NFP", "Jobless Claims", "HDP",
  "Retail Sales", "Nemovitosti", "Breaking News", "Projevy", "Ostatní",
];

export function vClass(v) {
  if (v === "+") return "v-pos";
  if (v === "-" || v === "−") return "v-neg";
  if (v === "0") return "v-neu";
  return "v-non";
}
export function cClass(v) {
  if (v === "+") return "c-pos";
  if (v === "-" || v === "−") return "c-neg";
  if (v === "0") return "c-neu";
  return "c-non";
}
export function vLabel(v) {
  if (v === "+") return "pozitivní";
  if (v === "-" || v === "−") return "negativní";
  if (v === "0") return "smíšené";
  return "—";
}
export function vSym(v) {
  if (v === "+") return "+";
  if (v === "0") return "0";
  if (v) return "−";
  return "·";
}
export function czDate(iso) {
  if (!iso) return "—";
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? `${+p[2]}.${+p[1]}.${p[0]}` : iso;
}
export function shortDate(iso) {
  if (!iso) return "";
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? `${+p[2]}.${+p[1]}.` : iso;
}
export const filled = (v) => v && String(v).trim() !== "";
