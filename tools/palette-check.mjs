#!/usr/bin/env node
// Palette legibility: pairwise colour distance (CIE76 ΔE in Lab) between neighbouring provider and operator colours,
// as seen normally and under a deuteranopia simulation (Machado et al. 2009, severity 1.0). ΔE below ~10 is hard to tell apart.
//   node tools/palette-check.mjs
import { PROVIDER_COLOR, OPERATOR_COLOR } from "../js/colors.js";
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const toRGB = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const DEUT = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]];
const sim = rgb => { const l = rgb.map(lin); const o = DEUT.map(r => r[0] * l[0] + r[1] * l[1] + r[2] * l[2]); return o.map(v => { v = Math.max(0, Math.min(1, v)); return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); }); };
const lab = rgb => { const [r, g, b] = rgb.map(lin); let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883; const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; [x, y, z] = [x, y, z].map(f); return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; };
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
for (const [title, pal] of [["Model providers", PROVIDER_COLOR], ["Data centre operators", OPERATOR_COLOR]]){
  const names = Object.keys(pal); console.log(`\n${title}: smallest ΔE to any other colour (normal / deuteranopia)`);
  let worst = Infinity, worstPair = "";
  for (const a of names){ let minN = Infinity, minD = Infinity, nn = "", nd = "";
    for (const b of names){ if (a === b) continue; const n = dE(toRGB(pal[a]), toRGB(pal[b])), d = dE(sim(toRGB(pal[a])), sim(toRGB(pal[b]))); if (n < minN){ minN = n; nn = b; } if (d < minD){ minD = d; nd = b; } if (d < worst){ worst = d; worstPair = a + " vs " + b; } }
    console.log(`  ${a.padEnd(10)} #${pal[a].toString(16).padStart(6, "0")}  ${minN.toFixed(0).padStart(3)} (${nn})  /  ${minD.toFixed(0).padStart(3)} (${nd})`); }
  console.log(`  weakest deuteranopia pair: ${worstPair}, ΔE ${worst.toFixed(1)}`);
}
