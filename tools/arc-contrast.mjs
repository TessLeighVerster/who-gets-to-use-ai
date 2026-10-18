#!/usr/bin/env node
// Arc readability: WCAG-style luminance contrast of each operator colour against the baseplate, the land discs and the
// off-white brick, with and without the dark outline tube. node tools/arc-contrast.mjs
import { OPERATOR_COLOR, PROVIDER_COLOR } from "../js/colors.js";
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = h => { const r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255; return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const backdrops = { plate: 0x272b34, "land disc": 0x474d5a, "off-white brick": PROVIDER_COLOR.openai, outline: 0x0d0c0a };
console.log("operator".padEnd(11) + Object.keys(backdrops).map(k => k.padEnd(17)).join(""));
let worst = Infinity;
for (const [op, hex] of Object.entries(OPERATOR_COLOR)){
  const r = Object.values(backdrops).map(b => ratio(hex, b)); worst = Math.min(worst, ...r.slice(0, 3));
  console.log(op.padEnd(11) + r.map(x => (x.toFixed(1) + ":1").padEnd(17)).join(""));
}
console.log(`\nweakest tube-vs-backdrop contrast ${worst.toFixed(1)}:1; the outline (#0d0c0a) sits between tube and backdrop everywhere, so every arc keeps an edge of at least ${Math.min(...Object.values(OPERATOR_COLOR).map(h => ratio(h, 0x0d0c0a))).toFixed(1)}:1 against it.`);
