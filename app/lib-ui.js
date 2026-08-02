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

// Jak moc která kategorie hýbe trhem. Používá se dvakrát:
//  1. na váhu události, která už proběhla (co repricing způsobilo)
//  2. na váhu události, která teprve přijde (kde bude příští týden pohyb)
// Press conference nahoře — forward guidance přebíjí samotné rozhodnutí.
export const KAT_VAHA = {
  "PRESS CONFERENCE": 12, "INTEREST RATE": 10, FOMC: 8, SPEAK: 3,
  CPI: 10, "CORE CPI": 10, PCE: 8, "TOKYO CPI": 6, "TOKYO CORE CPI": 6,
  PPI: 5, "CORE PPI": 5,
  "NONFARM PAYROLLS": 10, "UNEMPLOYMENT RATE": 7, "EMPLOYMENT CHANGE": 6,
  "ADP NFP": 5, "ADP EMPLOYMENT CHANGE": 4, "UNEMPLOYMENT CHANGE": 4,
  JOLTS: 4, "INITIAL JOBLESS CLAIMS": 3,
  GDP: 8, "RETAIL SALES": 6, "CORE RETAIL SALES": 5, PMI: 5, "CONSUMER CONFIDENCE": 3,
  "BUILDING PERMITS": 3, "HOUSING STARTS": 3, "NEW HOME SALES": 3, "EXISTING HOME SALES": 3,
  "BREAKING NEWS": 8, ELECTION: 6, "OTHER NEWS": 1, "BANK HOLIDAY": 0,
};
export const vahaKat = (k) => (k && KAT_VAHA[k] !== undefined ? KAT_VAHA[k] : 3);

// Které kategorie se počítají do síly měny. Stejné pravidlo jako u SHRNUTÍ
// v CELKOVÉM PŘEHLEDU: jen press conference, sazby, CPI, trh práce, projevy
// a breaking news. PMI, PPI, HDP, retail sales, PCE ani nemovitosti sem
// nepatří — jsou to podružné věci, které by hlavní signál jen zašuměly.
export const PODSTATNE = [
  "PRESS CONFERENCE",
  "INTEREST RATE", "FOMC",
  "CPI", "CORE CPI", "TOKYO CPI", "TOKYO CORE CPI",
  // PCE je inflační ukazatel, který Fed preferuje před CPI — počítá se,
  // i když v SHRNUTÍ celkového přehledu vlastní sekci nemá.
  "PCE",
  "UNEMPLOYMENT RATE", "UNEMPLOYMENT CHANGE", "EMPLOYMENT CHANGE",
  "NONFARM PAYROLLS", "ADP NFP", "ADP EMPLOYMENT CHANGE",
  "INITIAL JOBLESS CLAIMS", "JOLTS",
  "SPEAK",
  "BREAKING NEWS", "ELECTION",
];
export const jePodstatne = (k) => PODSTATNE.includes(String(k || "").toUpperCase());

/* Ručně psané záznamy často nemají vyplněnou KATEGORII — čísla i téma jsou
   jen v textu. Kdybychom je proto zahodili, přišli bychom o většinu
   fundamentu. Kategorii se proto pokusíme odvodit z popisu.

   Pořadí je důležité: nejdřív se vyloučí věci, které se snadno pletou
   (PPI mluví o inflačních tlacích, HDP o ekonomice), teprve pak se hledá
   to podstatné. Vrací null, když si nejsme jistí. */
const VZORY_NEPODSTATNE = [
  /\bPMI\b|nákupních manažerů/i,
  /\bPPI\b|ceny výrobců|cen výrobců/i,
  /\bHDP\b|\bGDP\b|hrubý domácí produkt/i,
  /maloobchod|retail sales/i,
  /spotřebitelsk[áé] důvěr|consumer confidence|consumer climate/i,
  /stavebn[íi] povolen|housing starts|home sales|building permits/i,
  /obchodní bilance|trade balance|průmyslov[áé] výrob/i,
];
// Pořadí = priorita. Konkrétnější témata musí být nad obecnějšími:
// „žádosti o podporu v nezaměstnanosti" jsou jobless claims, ne míra
// nezaměstnanosti; zpráva o příměří je breaking news, i když v ní někdo
// něco „uvedl".
const VZORY_PODSTATNE = [
  [/tiskov[áé]\s*konferenc|tiskovce|press conference/i, "PRESS CONFERENCE"],
  // \S* místo \w* — \w v JavaScriptu nezahrnuje á, é, í, ž a spol.,
  // takže „úrokové sazby" by přes \w* nikdy neprošlo
  [/úrokov\S*\s*sazb|ponechala sazby|rozhodnut[íi] o sazb|zvýšen[íi] sazeb|sn[íi]žen[íi] sazeb|\bFOMC\b|\bBoJ\b|\bECB\b/i, "INTEREST RATE"],
  // PCE musí být nad CPI — text o PCE skoro vždycky mluví i o inflaci
  [/\bPCE\b/i, "PCE"],
  [/inflac|\bCPI\b|spotřebitelsk[éý]ch cen|cenov[éý] tlak/i, "CPI"],
  [/žádost[ií] o podporu|jobless claims|unemployment claims/i, "INITIAL JOBLESS CLAIMS"],
  [/nonfarm|payrolls|\bNFP\b/i, "NONFARM PAYROLLS"],
  [/\bJOLTS\b|volných pracovních míst/i, "JOLTS"],
  [/nezaměstnanost|unemployment/i, "UNEMPLOYMENT RATE"],
  [/zaměstnanost|employment change/i, "EMPLOYMENT CHANGE"],
  [/příměř|konflikt|válk|intervenc|útok|eskalac|sankc|demis|jadern/i, "BREAKING NEWS"],
  [/guvernér|prohlásil|projev|speaks|člen (rady|FOMC)/i, "SPEAK"],
];

export function odvodKategorii(info) {
  const t = String(info || "");
  if (!t.trim()) return null;
  if (VZORY_NEPODSTATNE.some((r) => r.test(t))) return null;
  for (const [re, kat] of VZORY_PODSTATNE) {
    if (re.test(t)) return kat;
  }
  return null;
}

/* Kategorie události pro účely vážení: buď vyplněná, nebo odvozená z textu.
   Vrací { kat, odvozeno } — ať se dá v UI přiznat, že jde o odhad. */
export function kategorieUdalosti(e) {
  if (e && e.kategorie && String(e.kategorie).trim()) {
    return { kat: String(e.kategorie).toUpperCase(), odvozeno: false };
  }
  const odvozena = odvodKategorii(e && e.info);
  return odvozena ? { kat: odvozena, odvozeno: true } : { kat: null, odvozeno: false };
}

// Pořadí měn podle konvence kotace — dřívější je vždy základní (bázová).
export const KOTACE = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY"];

// Provázané měny. Když se dvě měny hýbou spolu, rozdíl mezi nimi se hůř
// obchoduje — jedna druhou dotahuje. Skóre páru se proto tlumí.
// Zdroj: vlastní poznámky k fundamentu (USD+CAD ekonomicky provázané,
// AUD+NZD geograficky a obchodně, zlato proti dolaru obráceně).
export const KORELACE = [
  { mena: ["USD", "CAD"], sila: 0.6 },
  { mena: ["AUD", "NZD"], sila: 0.8 },
];
// klíč se normalizuje abecedně, ať nezáleží na pořadí měn v páru
const KOR_MAPA = {};
KORELACE.forEach(({ mena, sila }) => {
  KOR_MAPA[[...mena].sort().join("|")] = sila;
});
export function korelace(a, b) {
  if (!a || !b || a === b) return 0;
  return KOR_MAPA[[a, b].sort().join("|")] || 0;
}
// Zlato se pohybuje proti dolaru — jak silně, je odhad, ne měřená hodnota.
export const XAU_VS_USD = -0.7;

// Data z Německa, Francie a Španělska se pro sílu měny počítají do eura.
export const doHlavni = (c) => (String(c || "").startsWith("EUR") ? "EUR" : c);

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
