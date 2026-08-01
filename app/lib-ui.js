// Měny a instrumenty. EUR má varianty podle zemí — rozlišují se vlajkou.
export const FLAG = {
  EUR: "🇪🇺", "EUR-DE": "🇩🇪", "EUR-FR": "🇫🇷", "EUR-ES": "🇪🇸",
  USD: "🇺🇸", GBP: "🇬🇧", JPY: "🇯🇵",
  CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿", CHF: "🇨🇭",
};

export const CUR_NAME = {
  EUR: "EUR — eurozóna", "EUR-DE": "EUR — Německo",
  "EUR-FR": "EUR — Francie", "EUR-ES": "EUR — Španělsko",
  USD: "USD", GBP: "GBP", JPY: "JPY",
  CAD: "CAD", AUD: "AUD", NZD: "NZD", CHF: "CHF",
};

// hlavní měny — mají vlastní sazby, celkový přehled a týdenní záznamy
export const MAIN_CUR = ["EUR", "USD", "GBP", "JPY", "CAD", "AUD", "NZD", "CHF"];
// varianty eurozóny — jen ve FUNDAMENTU jako zdroj dat
export const EUR_VARIANTS = ["EUR-DE", "EUR-FR", "EUR-ES"];
// vše, co jde vybrat u události
export const ALL_CUR = [...MAIN_CUR, ...EUR_VARIANTS];
// pro sentiment navíc komodity a indexy
export const SENT_INSTR = [...MAIN_CUR, "XAU", "XAG", "Indexy"];

// Press conference je nahoře — forward guidance hýbe trhem víc než samotné rozhodnutí.
export const PRIO = [
  "PRESS CONFERENCE", "SAZBY", "CPI", "NEZAMĚSTNANOST",
  "ZAMĚSTNANOST", "BREAKING NEWS", "PROJEVY",
];
export const REST = [
  "PCE", "PPI", "NFP", "JOBLESS CLAIMS", "JOLTS",
  "PMI", "HDP", "RETAIL SALES", "SPOTŘEBITELSKÁ DŮVĚRA", "NEMOVITOSTI",
];

// Kategorie událostí — odpovídají DATABÁZI ZPRÁV v Notionu.
export const KAT_GROUPS = [
  { label: "Sazby a centrální banky", items: ["INTEREST RATE", "PRESS CONFERENCE", "FOMC", "SPEAK"] },
  { label: "Inflace", items: ["CPI", "CORE CPI", "TOKYO CPI", "TOKYO CORE CPI", "PPI", "CORE PPI", "PCE"] },
  { label: "Trh práce", items: ["UNEMPLOYMENT RATE", "EMPLOYMENT CHANGE", "UNEMPLOYMENT CHANGE", "NONFARM PAYROLLS", "ADP NFP", "ADP EMPLOYMENT CHANGE", "INITIAL JOBLESS CLAIMS", "JOLTS"] },
  { label: "Ekonomika", items: ["GDP", "PMI", "RETAIL SALES", "CORE RETAIL SALES", "CONSUMER CONFIDENCE"] },
  { label: "Nemovitosti", items: ["BUILDING PERMITS", "HOUSING STARTS", "NEW HOME SALES", "EXISTING HOME SALES"] },
  { label: "Ostatní", items: ["BREAKING NEWS", "ELECTION", "BANK HOLIDAY", "OTHER NEWS"] },
];
export const KATEGORIE = KAT_GROUPS.flatMap((g) => g.items);

export const JEDNOTKY = ["%", "body", "tis.", "mld.", "index", "bps", "jiné"];

// do které sekce CELKOVÉHO PŘEHLEDU kategorie patří
export const KAT_TO_SEKCE = {
  "INTEREST RATE": "SAZBY", "FOMC": "SAZBY",
  "PRESS CONFERENCE": "PRESS CONFERENCE", "SPEAK": "PROJEVY",
  "CPI": "CPI", "CORE CPI": "CPI", "TOKYO CPI": "CPI", "TOKYO CORE CPI": "CPI",
  "PPI": "PPI", "CORE PPI": "PPI", "PCE": "PCE",
  "UNEMPLOYMENT RATE": "NEZAMĚSTNANOST", "UNEMPLOYMENT CHANGE": "NEZAMĚSTNANOST",
  "EMPLOYMENT CHANGE": "ZAMĚSTNANOST", "ADP EMPLOYMENT CHANGE": "ZAMĚSTNANOST",
  "NONFARM PAYROLLS": "NFP", "ADP NFP": "NFP",
  "INITIAL JOBLESS CLAIMS": "JOBLESS CLAIMS", "JOLTS": "JOLTS",
  "GDP": "HDP", "PMI": "PMI",
  "RETAIL SALES": "RETAIL SALES", "CORE RETAIL SALES": "RETAIL SALES",
  "CONSUMER CONFIDENCE": "SPOTŘEBITELSKÁ DŮVĚRA",
  "BUILDING PERMITS": "NEMOVITOSTI", "HOUSING STARTS": "NEMOVITOSTI",
  "NEW HOME SALES": "NEMOVITOSTI", "EXISTING HOME SALES": "NEMOVITOSTI",
  "BREAKING NEWS": "BREAKING NEWS", "ELECTION": "BREAKING NEWS",
};

// obvyklá jednotka pro kategorii — předvyplní se ve formuláři
export const KAT_JEDNOTKA = {
  "INTEREST RATE": "%", "CPI": "%", "CORE CPI": "%", "TOKYO CPI": "%", "TOKYO CORE CPI": "%",
  "PPI": "%", "CORE PPI": "%", "PCE": "%", "GDP": "%",
  "UNEMPLOYMENT RATE": "%", "RETAIL SALES": "%", "CORE RETAIL SALES": "%",
  "NONFARM PAYROLLS": "tis.", "ADP NFP": "tis.", "EMPLOYMENT CHANGE": "tis.",
  "ADP EMPLOYMENT CHANGE": "tis.", "UNEMPLOYMENT CHANGE": "tis.",
  "INITIAL JOBLESS CLAIMS": "tis.", "JOLTS": "mld.",
  "PMI": "index", "CONSUMER CONFIDENCE": "body",
  "BUILDING PERMITS": "%", "HOUSING STARTS": "mld.",
  "NEW HOME SALES": "%", "EXISTING HOME SALES": "mld.",
};

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
export const DNY = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
export function denVTydnu(iso) {
  if (!iso) return "";
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
  return isNaN(d) ? "" : DNY[d.getDay()];
}
export const filled = (v) => v && String(v).trim() !== "";
