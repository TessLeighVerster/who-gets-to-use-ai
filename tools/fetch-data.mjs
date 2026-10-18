#!/usr/bin/env node
/* Rebuilds data/countries.js from public datasets and adds per-field provenance.
   Node 18+, no dependencies (fetch, zlib). Usage:
     node tools/fetch-data.mjs            downloads everything, writes data/raw/… and data/countries.js, prints the report
     node tools/fetch-data.mjs --offline  reuses the files already in data/raw/ (and the cached Economic Index CSV in the OS temp dir)
   Sources (keys in data/sources.js):
     World Bank API  IT.NET.USER.ZS, EG.ELC.ACCS.ZS, NY.GDP.PCAP.CD, SP.POP.TOTL  → latest non-null year per country
     Cable.co.uk     Worldwide Mobile Data Pricing 2023 (xlsx) → average price of 1GB in USD
     Anthropic Economic Index release 2026-06-26 → usage_per_capita_index per country, latest month, rescaled so the top listed country = 100
   Everything not covered keeps its current value and is marked estimated. */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "data", "raw");
const OFFLINE = process.argv.includes("--offline");
const TODAY = new Date().toISOString().slice(0, 10);

const WB = {   // field → [indicator, source key, transform]
  internetPenetration: ["IT.NET.USER.ZS", "worldbank-it-net-user-zs", v => +(v / 100).toFixed(3)],
  electricityAccess:   ["EG.ELC.ACCS.ZS", "worldbank-eg-elc-accs-zs", v => +(v / 100).toFixed(3)],
  gdpPerCapita:        ["NY.GDP.PCAP.CD", "worldbank-ny-gdp-pcap-cd", v => Math.round(v)],
  population:          ["SP.POP.TOTL",    "worldbank-sp-pop-totl",    v => +(v / 1e6).toFixed(1)],   // millions
};
const CABLE_URL = "https://540k006f.tinifycdn.com/mobiles/worldwide-data-pricing/2023/worldwide_mobile_data_pricing_data.xlsx";
const CABLE_KEY = "cable-mobile-data-pricing-2023", CABLE_YEAR = 2023;
const AEI_URL = "https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/release_2026_06_26/data/aei_claude_ai_2026-06-26.csv";
const AEI_KEY = "anthropic-economic-index-2026-06-26";
const ESTIMATED_WHOLESALE = ["activeUsers", "providerShare", "growthCurve", "cities", "capabilities", "barriers", "facts"];
const MODEL_YEAR = 2026;

const log = (...a) => console.error(...a);
const ensure = d => fs.mkdirSync(d, { recursive: true });
async function download(url, file, { headers } = {}){
  if (OFFLINE && fs.existsSync(file)){ log(`  using cached ${path.relative(ROOT, file)}`); return; }
  log(`  fetching ${url}`);
  const r = await fetch(url, { headers: { "user-agent": "who-gets-to-use-ai fetch-data (github.com/TessLeighVerster)", ...headers } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  ensure(path.dirname(file)); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

/* ---------- World Bank ---------- */
async function worldBank(indicator){
  const file = path.join(RAW, "worldbank", `${indicator}.json`);
  await download(`https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&date=2010:${new Date().getFullYear()}&per_page=20000`, file);
  const [meta, rows] = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(rows)) throw new Error(`unexpected World Bank response for ${indicator}: ${JSON.stringify(meta).slice(0, 200)}`);
  const latest = new Map(), iso3to2 = new Map();   // iso2 → {value, year}; latest non-null year wins
  for (const r of rows){
    if (r.countryiso3code && r.country && r.country.id) iso3to2.set(r.countryiso3code, r.country.id);
    if (r.value === null || r.value === undefined) continue;
    const iso = r.country.id, year = +r.date, cur = latest.get(iso);
    if (!cur || year > cur.year) latest.set(iso, { value: r.value, year });
  }
  return { latest, iso3to2, lastUpdated: meta.lastupdated };
}

/* ---------- Cable.co.uk xlsx (a zip of XML; read it with zlib, no library) ---------- */
function unzip(buf){
  const files = {}; let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip file");
  let p = buf.readUInt32LE(eocd + 16); const n = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < n; i++){
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central directory");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const lnlen = buf.readUInt16LE(off + 26), lelen = buf.readUInt16LE(off + 28), start = off + 30 + lnlen + lelen;
    const data = buf.subarray(start, start + csize);
    files[name] = method === 8 ? zlib.inflateRawSync(data) : method === 0 ? data : null;
    p += 46 + nlen + elen + clen;
  }
  return files;
}
const unxml = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function sheetRows(files, sheet = "xl/worksheets/sheet1.xml"){
  const ss = [...(files["xl/sharedStrings.xml"] || "").toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const rows = [];
  for (const row of files[sheet].toString("utf8").matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){
    const cells = {};
    for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const col = c[1], attrs = c[2] || "", inner = c[3] || "";
      const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1], t = (attrs.match(/t="(\w+)"/) || [])[1];
      if (v === undefined){ const is = (inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1]; if (is !== undefined) cells[col] = unxml(is); continue; }
      cells[col] = t === "s" ? ss[+v] : t === "str" || t === "inlineStr" ? unxml(v) : +v;
    }
    rows.push(cells);
  }
  return rows;
}
async function cable(listed){   // listed: the ISO codes in data/countries.js; the committed extract carries only those rows (see data/raw/LICENSES.md)
  const dir = path.join(RAW, "cable"), file = path.join(dir, "worldwide_mobile_data_pricing_2023.xlsx");
  await download(CABLE_URL, file);
  const rows = sheetRows(unzip(fs.readFileSync(file)));
  const head = rows.find(r => Object.values(r).includes("Country code") && Object.values(r).some(v => /Average price of 1GB \(USD\)/.test(String(v))));
  if (!head) throw new Error("Cable.co.uk sheet: header row not found (did the layout change?)");
  const col = name => Object.keys(head).find(k => String(head[k]).startsWith(name));
  const cIso = col("Country code"), cName = col("Name"), cUsd = col("Average price of 1GB (USD)"), cPlans = col("Plans measured");
  const out = new Map(), csv = ["country_code,name,plans_measured,average_price_1gb_usd"];
  for (const r of rows.slice(rows.indexOf(head) + 1)){
    const iso = r[cIso], usd = r[cUsd];
    if (typeof iso !== "string" || iso.length !== 2 || typeof usd !== "number") continue;
    out.set(iso, usd); if (listed.has(iso)) csv.push(`${iso},"${String(r[cName]).replace(/"/g, '""')}",${r[cPlans] ?? ""},${usd}`);
  }
  fs.writeFileSync(path.join(dir, "average_price_1gb_usd_2023.csv"), csv.join("\n") + "\n");   // the extract that is committed
  return out;
}

/* ---------- Anthropic Economic Index ---------- */
async function economicIndex(iso3to2){
  const dir = path.join(RAW, "anthropic-economic-index"), extract = path.join(dir, "usage_per_capita_index_by_country_2026-06-26.csv");
  const cache = path.join(os.tmpdir(), "aei_claude_ai_2026-06-26.csv");   // 219 MB: cached outside the repo, never committed
  if (!(OFFLINE && fs.existsSync(extract))){
    if (!fs.existsSync(cache)) await download(AEI_URL, cache);
    const lines = ["date_start,date_end,geo_id,geo_level,category_name,metric_id,value"];
    const rl = (await import("node:readline")).createInterface({ input: fs.createReadStream(cache) });
    for await (const line of rl){ const f = line.split(","); if (f[3] === "country" && f[4] === "overall" && f[6] === "usage_per_capita_index") lines.push([f[0], f[1], f[2], f[3], f[4], f[6], f[7]].join(",")); }
    ensure(dir); fs.writeFileSync(extract, lines.join("\n") + "\n");
  }
  const latest = new Map();   // iso2 → {value, month}
  for (const line of fs.readFileSync(extract, "utf8").trim().split("\n").slice(1)){
    const [start, , geo, , , , value] = line.split(",");
    const iso2 = iso3to2.get(geo) || (geo === "TWN" ? "TW" : null); if (!iso2) continue;
    const cur = latest.get(iso2); if (!cur || start > cur.month) latest.set(iso2, { value: +value, month: start });
  }
  return latest;
}

/* ---------- serialise data/countries.js ---------- */
const lit = v => Array.isArray(v) ? "[" + v.map(lit).join(",") + "]" : v && typeof v === "object" ? "{" + Object.entries(v).map(([k, x]) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ":" + lit(x)).join(",") + "}" : JSON.stringify(v);
const prov = p => "{ " + Object.entries(p).map(([k, x]) => k + ":" + (k === "value" ? lit(x) : JSON.stringify(x))).join(", ") + " }";
const HEADER = `/**
 * DATA — countries. Every numeric field is a provenance object { value, source, year, estimated } where \`source\`
 * is a key into data/sources.js and \`year\` is the data year (World Bank: latest non-null year for that country).
 * js/model.js unwraps these at load so the app keeps reading plain numbers (c.internetPenetration …) and finds the
 * provenance under c.provenance[field]. Regenerate with: node tools/fetch-data.mjs (see data/raw/LICENSES.md).
 *
 * countries[]:
 *   iso, name, continent, lat, lon   bare (not provenance objects)
 *   population        millions · World Bank SP.POP.TOTL
 *   usageIndex        0–100 · Anthropic Economic Index usage_per_capita_index (Claude.ai usage share ÷ working-age population share),
 *                     latest month per country, rescaled so the top listed country = 100. This is a CLAUDE-USAGE PROXY, not a measure of
 *                     all-AI usage; countries absent from the index keep the earlier modelled value and are marked estimated.
 *   activeUsers       millions using an AI assistant at least monthly · no sourced series; modelled estimate (estimated:true)
 *   providerShare     share of usage by model provider, keys anthropic, openai, google, meta, mistral, deepseek, local; sums to 1 · modelled (estimated:true)
 *   internetPenetration 0–1 · World Bank IT.NET.USER.ZS (ITU series), % ÷ 100
 *   gdpPerCapita      USD, nominal · World Bank NY.GDP.PCAP.CD (current US$)
 *   subscriptionShareOfIncome  % · DERIVED: (20 × 12) ÷ gdpPerCapita × 100, i.e. a US$20/month plan as a share of GDP per capita.
 *                     Honest name: "share of GDP per capita per month"; GDP per capita is not median income (the UI label still says
 *                     median income and is to be changed when the UI is migrated).
 *   growthCurve       [2022, 2023, 2024, 2025, 2026] usage as a fraction of today's (2026 = 1) · modelled (estimated:true)
 *   electricityAccess 0–1 · World Bank EG.ELC.ACCS.ZS, % ÷ 100
 *   dataCostPerGB     USD for 1 GB of mobile data · Cable.co.uk Worldwide Mobile Data Pricing 2023, average price of 1GB (USD)
 *   capabilities      2–4 short strings: what the country has going for it · editorial (estimated:true)
 *   barriers          2–4 short strings: what holds AI usage and adoption back · editorial (estimated:true)
 *   cities            [name, lat, lon, metro population (millions), usage per person relative to the national average] · modelled (estimated:true)
 *   facts             three short strings: models, companies, restrictions or pricing · editorial (estimated:true)
 */
`;
function serialise(countries){
  const out = [HEADER, "export const countries = ["];
  let cont = null;
  countries.forEach((c, i) => {
    if (c.continent !== cont){ cont = c.continent; out.push(`    // ---------------- ${cont} ----------------`); }
    const P = c.provenance;
    const line1 = `    { iso:${JSON.stringify(c.iso)}, name:${JSON.stringify(c.name)}, continent:${JSON.stringify(c.continent)}, lat:${c.lat}, lon:${c.lon},`;
    const fields = ["population", "usageIndex", "activeUsers", "providerShare", "internetPenetration", "gdpPerCapita", "subscriptionShareOfIncome", "electricityAccess", "dataCostPerGB", "growthCurve", "capabilities", "barriers", "cities", "facts"];
    const body = fields.map(f => `      ${f}:${prov({ value: c[f], ...P[f] })}`);
    out.push(line1, body.join(",\n") + " }" + (i < countries.length - 1 ? "," : ""));
  });
  out.push("];", "");
  return out.join("\n");
}

/* ---------- main ---------- */
const mod = await import(pathToFileURL(path.join(ROOT, "data", "countries.js")).href);
// accept either shape: plain numbers (first run) or provenance objects (later runs)
const unwrap = c => { const o = { ...c, provenance: {} }; for (const [k, v] of Object.entries(c)) if (v && typeof v === "object" && !Array.isArray(v) && "value" in v && "estimated" in v){ const { value, ...p } = v; o[k] = value; o.provenance[k] = p; } return o; };
const countries = mod.countries.map(unwrap);
log(`${countries.length} countries in data/countries.js`);

log("World Bank");
const wb = {}; let iso3to2 = new Map();
for (const [field, [ind]] of Object.entries(WB)){ wb[field] = await worldBank(ind); for (const [k, v] of wb[field].iso3to2) iso3to2.set(k, v); }
log("Cable.co.uk"); const cableMap = await cable(new Set(countries.map(c => c.iso)));
log("Anthropic Economic Index"); const aei = await economicIndex(iso3to2);
const aeiMax = Math.max(...countries.map(c => aei.get(c.iso)?.value ?? 0));
log(`  index present for ${countries.filter(c => aei.has(c.iso)).length} of ${countries.length} countries; top listed country index ${aeiMax} (= 100)`);

const report = {}, missing = {};   // metric → {sourced, estimated, missing}; metric → [iso]
const tally = (f, kind, iso) => { (report[f] ||= { sourced: 0, estimated: 0, missing: 0 })[kind]++; if (kind === "missing") (missing[f] ||= []).push(iso); };
for (const c of countries){
  const P = c.provenance;
  for (const [field, [ , key, fn]] of Object.entries(WB)){
    const hit = wb[field].latest.get(c.iso);
    if (hit){ c[field] = fn(hit.value); P[field] = { source: key, year: hit.year, estimated: false }; tally(field, "sourced", c.iso); }
    else { P[field] = { source: "model", year: MODEL_YEAR, estimated: true, missingFrom: key }; tally(field, "missing", c.iso); }
  }
  const usd = cableMap.get(c.iso);
  if (usd !== undefined){ c.dataCostPerGB = +usd.toFixed(2); P.dataCostPerGB = { source: CABLE_KEY, year: CABLE_YEAR, estimated: false }; tally("dataCostPerGB", "sourced", c.iso); }
  else { P.dataCostPerGB = { source: "model", year: MODEL_YEAR, estimated: true, missingFrom: CABLE_KEY }; tally("dataCostPerGB", "missing", c.iso); }
  const u = aei.get(c.iso);
  if (u){ c.usageIndex = +(u.value / aeiMax * 100).toFixed(1); P.usageIndex = { source: AEI_KEY, year: +u.month.slice(0, 4), month: u.month.slice(0, 7), estimated: false }; tally("usageIndex", "sourced", c.iso); }
  else { P.usageIndex = { source: "model", year: MODEL_YEAR, estimated: true, missingFrom: AEI_KEY }; tally("usageIndex", "missing", c.iso); }
  if (P.gdpPerCapita.estimated === false){ c.subscriptionShareOfIncome = +((20 * 12) / c.gdpPerCapita * 100).toFixed(1); P.subscriptionShareOfIncome = { source: "derived", year: P.gdpPerCapita.year, estimated: false, derived: true, formula: "(20*12)/gdpPerCapita*100" }; tally("subscriptionShareOfIncome", "sourced", c.iso); }
  else { P.subscriptionShareOfIncome = { source: "model", year: MODEL_YEAR, estimated: true, derived: true, formula: "(20*12)/gdpPerCapita*100", missingFrom: "worldbank-ny-gdp-pcap-cd" }; tally("subscriptionShareOfIncome", "missing", c.iso); }
  for (const f of ESTIMATED_WHOLESALE){ P[f] = { source: "model", year: MODEL_YEAR, estimated: true }; tally(f, "estimated", c.iso); }
}
fs.writeFileSync(path.join(ROOT, "data", "countries.js"), serialise(countries));
log(`wrote data/countries.js`);

// report
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nProvenance across ${countries.length} countries (sourced = value from the named dataset; estimated = kept as a modelled value by design; missing = dataset consulted but has no value for that country, modelled value kept and flagged)\n`);
console.log(pad("metric", 28) + pad("sourced", 9) + pad("estimated", 11) + "missing");
for (const [f, r] of Object.entries(report)) console.log(pad(f, 28) + pad(r.sourced, 9) + pad(r.estimated, 11) + r.missing);
console.log("\nCountries where a sourced metric is missing:");
const byIso = {}; for (const [f, isos] of Object.entries(missing)) for (const iso of isos) (byIso[iso] ||= []).push(f);
if (!Object.keys(byIso).length) console.log("  none");
for (const [iso, fs_] of Object.entries(byIso).sort()) console.log(`  ${iso} ${countries.find(c => c.iso === iso).name}: ${fs_.join(", ")}`);
console.log(`\nWorld Bank API last updated ${wb.population.lastUpdated}; Cable.co.uk 2023 release; Economic Index release 2026-06-26 (latest month per country). Run date ${TODAY}.`);
