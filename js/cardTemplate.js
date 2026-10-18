/* One drawing routine for the country card image, shared by the in-app share (js/shareCard.js, 1080×1080 PNG on an
   offscreen canvas) and the link-preview renderer (tools/render-cards.mjs, 1200×630 PNG per country). Pure: takes a
   model built by cardModel() and a 2D context; no DOM, no Three.js. Fonts: the site's system stack. */
import { PROVIDERS, PROVIDER_COLOR, CSS_TOKENS } from "./colors.js";

export const SITE = "whogetstobuildwithai.com";
const FONT = CSS_TOKENS.font;
const hex = h => "#" + h.toString(16).padStart(6, "0");

/* The three stats shown, each compared with the top country (highest usage index). `est` marks a value that is an
   estimate rather than a sourced figure, per the provenance in data/countries.js. */
export function cardModel(c, countries){
  const top = countries.reduce((a, b) => (b.usageIndex > a.usageIndex ? b : a), countries[0]);
  const est = (x, f) => !!(x.provenance && x.provenance[f] && x.provenance[f].estimated);
  const stats = [
    { label: "Usage index", sub: "top country = 100", value: c.usageIndex, top: top.usageIndex, display: v => (Math.round(v * 10) / 10).toString(), est: est(c, "usageIndex"), topEst: est(top, "usageIndex") },
    { label: "$20 AI plan as a share of monthly income", sub: "per person, GDP basis", value: c.subscriptionShareOfIncome, top: top.subscriptionShareOfIncome, display: v => v + "%", est: est(c, "subscriptionShareOfIncome"), topEst: est(top, "subscriptionShareOfIncome"), lowerIsBetter: true },
    { label: "People online", sub: "internet users, share of population", value: Math.round(c.internetPenetration * 100), top: Math.round(top.internetPenetration * 100), display: v => v + "%", est: est(c, "internetPenetration"), topEst: est(top, "internetPenetration") },
  ];
  return { iso: c.iso, name: c.name, continent: c.continent, topName: top.name, isTop: top.iso === c.iso, stats,
           providerShare: est(c, "providerShare") ? null : c.providerShare, dcCount: c.dcCount || 0, anyEst: stats.some(s => s.est || s.topEst) };
}

export function drawCard(ctx, m, W, H){
  const wide = W / H > 1.3;                          // 1200×630 link preview vs 1080×1080 share square
  const P = wide ? 56 : 72, text = CSS_TOKENS.text, muted = "rgba(245,245,247,0.62)", line = "rgba(255,255,255,0.12)";
  const f = (w, px) => `${w} ${px}px ${FONT}`;
  ctx.fillStyle = CSS_TOKENS.bg; ctx.fillRect(0, 0, W, H);
  // faint dot grid in the background, like the globe's land dots
  ctx.fillStyle = "rgba(147,163,201,0.10)";
  for (let y = 24; y < H; y += 26) for (let x = 24; x < W; x += 26){ ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.textBaseline = "alphabetic";
  // header
  ctx.fillStyle = muted; ctx.font = f(600, wide ? 20 : 24); ctx.fillText("Where it stands on AI access", P, P + (wide ? 18 : 22));
  ctx.fillStyle = text; ctx.font = f(700, wide ? 64 : 84); ctx.fillText(m.name, P, P + (wide ? 86 : 118));
  ctx.fillStyle = muted; ctx.font = f(500, wide ? 20 : 24); ctx.fillText(`${m.continent} · ${m.dcCount} data centre${m.dcCount === 1 ? "" : "s"} shown`, P, P + (wide ? 120 : 160));
  // stats: three rows (square) or three columns (wide)
  const rows = m.stats, est = "est.";
  const drawStat = (s, x, y, w) => {
    ctx.fillStyle = muted; ctx.font = f(500, wide ? 17 : 22); ctx.fillText(s.label, x, y);
    ctx.font = f(400, wide ? 14 : 18); ctx.fillText(s.sub, x, y + (wide ? 20 : 26));
    const big = wide ? 56 : 72; ctx.fillStyle = text; ctx.font = f(700, big);
    const v = s.display(s.value); ctx.fillText(v, x, y + (wide ? 84 : 112));
    if (s.est){ const vw = ctx.measureText(v).width; ctx.fillStyle = "rgba(245,245,247,0.5)"; ctx.font = f(600, wide ? 16 : 20); ctx.fillText(est, x + vw + 10, y + (wide ? 84 : 112)); }
    // comparison bars: this country, then the top country, on a shared scale
    const max = Math.max(s.value, s.top, 1e-9), by = y + (wide ? 104 : 136), bh = wide ? 10 : 14, bw = w;
    ctx.fillStyle = line; ctx.fillRect(x, by, bw, bh); ctx.fillRect(x, by + bh + (wide ? 10 : 12), bw, bh);
    ctx.fillStyle = text; ctx.fillRect(x, by, Math.max(3, bw * s.value / max), bh);
    ctx.fillStyle = "rgba(245,245,247,0.42)"; ctx.fillRect(x, by + bh + (wide ? 10 : 12), Math.max(3, bw * s.top / max), bh);
    ctx.fillStyle = muted; ctx.font = f(500, wide ? 14 : 17);
    const ty = by + bh * 2 + (wide ? 30 : 36);
    ctx.fillText(m.isTop ? `${m.name} is the top country` : `${m.topName} (top country): ${s.display(s.top)}${s.topEst ? " " + est : ""}${s.lowerIsBetter ? " · lower is better" : ""}`, x, ty);
  };
  if (wide){ const colW = (W - 2 * P - 2 * 40) / 3; rows.forEach((s, i) => drawStat(s, P + i * (colW + 40), P + 190, colW)); }
  else { rows.forEach((s, i) => drawStat(s, P, P + 240 + i * 212, W - 2 * P)); }   // each block is ~200 px tall
  // provider mix: thin stacked bar, only when the field is sourced (today it is estimated everywhere, so it is omitted)
  if (m.providerShare){
    const y = wide ? H - P - 84 : H - P - 112, w = W - 2 * P; let x = P;
    PROVIDERS.forEach(p => { const sw = w * (m.providerShare[p] || 0); if (sw <= 0) return; ctx.fillStyle = hex(PROVIDER_COLOR[p]); ctx.fillRect(x, y, sw, 8); x += sw; });
    ctx.fillStyle = muted; ctx.font = f(500, wide ? 14 : 17); ctx.fillText("whose models people use", P, y + 28);
  }
  // footer: site name left; sources right (wide) or on their own line above the rule (square), so the two never collide
  const sources = m.anyEst ? "est. = modelled estimate · other figures: World Bank, Cable.co.uk, Anthropic Economic Index" : "Sources: World Bank, Cable.co.uk, Anthropic Economic Index";
  ctx.fillStyle = line; ctx.fillRect(P, H - P - 36, W - 2 * P, 1);
  ctx.fillStyle = text; ctx.font = f(600, wide ? 20 : 24); ctx.fillText(SITE, P, H - P + 2);
  ctx.fillStyle = muted; ctx.font = f(400, wide ? 14 : 17);
  if (wide){ ctx.textAlign = "right"; ctx.fillText(sources, W - P, H - P + 2); ctx.textAlign = "left"; }
  else ctx.fillText(sources, P, H - P - 54);
}
