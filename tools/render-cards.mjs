#!/usr/bin/env node
// Renders c/{iso}/card.png (1200×630) for every country with Puppeteer, using js/cardTemplate.js through
// tools/card-render.html so the OG images match the in-app share card. Re-run whenever the data changes.
//   NODE_PATH=<dir with puppeteer> node tools/render-cards.mjs [--only=ZA,NG] [--square]   (--square also writes a 1080×1080 preview to tools/shots/)
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer"); const { serve } = require("./serve.js");
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, "..");
const opt = Object.fromEntries(process.argv.filter(a => a.startsWith("--")).map(a => a.slice(2).split("=")));
const srv = await serve(root);
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage(); await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(srv.url + "/tools/card-render.html", { waitUntil: "load" });
await page.waitForFunction(() => window.ready === true);
let isos = await page.evaluate(() => window.isos);
if (opt.only) isos = opt.only.split(",");
let total = 0;
for (const iso of isos){
  const data = await page.evaluate((iso) => window.renderCard(iso, 1200, 630), iso);
  const buf = Buffer.from(data.split(",")[1], "base64");
  const dir = path.join(root, "c", iso); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "card.png"), buf); total += buf.length;
  if (opt.square !== undefined){ const sq = await page.evaluate((iso) => window.renderCard(iso, 1080, 1080), iso); fs.mkdirSync(path.join(here, "shots"), { recursive: true }); fs.writeFileSync(path.join(here, "shots", `card-${iso}-1080.png`), Buffer.from(sq.split(",")[1], "base64")); }
}
await browser.close(); srv.close();
console.log(`${isos.length} cards, ${(total / 1e6).toFixed(2)} MB total (${Math.round(total / isos.length / 1e3)} KB each) under c/{iso}/card.png`);
