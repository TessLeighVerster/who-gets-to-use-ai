#!/usr/bin/env node
// Generates c/{iso}/index.html for every country: a tiny static page carrying country-specific title, description,
// Open Graph and Twitter tags (image: /c/{iso}/card.png) that redirects to /?country={iso}. Link unfurlers read the
// tags; browsers follow the redirect. Re-run whenever the data changes, then tools/render-cards.mjs for the images.
//   node tools/build-country-pages.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { countries } = await import(pathToFileURL(path.join(root, "data", "countries.js")).href);
const SITE = "https://whogetstobuildwithai.com";
const val = (c, f) => (c[f] && typeof c[f] === "object" && "value" in c[f]) ? c[f].value : c[f];
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const top = countries.reduce((a, b) => (val(b, "usageIndex") > val(a, "usageIndex") ? b : a), countries[0]);
let n = 0;
for (const c of countries){
  const iso = c.iso, name = c.name, url = `${SITE}/c/${iso}/`, img = `${SITE}/c/${iso}/card.png`;
  const title = `Where ${name} stands on AI access · Who gets to build with AI?`;
  const desc = `${name}: usage index ${Math.round(val(c, "usageIndex") * 10) / 10} out of 100 (top country ${top.name}); a $20/month AI plan is ${val(c, "subscriptionShareOfIncome")}% of monthly income per person; ${Math.round(val(c, "internetPenetration") * 100)}% of people are online. See yours on the Lego globe.`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${SITE}/?country=${iso}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Who gets to build with AI?">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(`${name}'s AI access card: usage index, cost of a $20 plan and people online, compared with ${top.name}`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${img}">
<meta http-equiv="refresh" content="0; url=/?country=${iso}">
<meta name="theme-color" content="#07080c">
<style>html,body{margin:0;height:100%;background:#07080c;color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif}body{display:flex;align-items:center;justify-content:center}a{color:#f5f5f7}</style>
</head>
<body>
<p>Opening ${esc(name)} on the globe… <a href="/?country=${iso}">Continue</a></p>
<script>location.replace("/?country=${iso}");</script>
</body>
</html>
`;
  const dir = path.join(root, "c", iso); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html); n++;
}
console.log(`${n} pages under c/{iso}/index.html`);
