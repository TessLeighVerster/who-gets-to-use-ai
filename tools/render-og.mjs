#!/usr/bin/env node
// Renders tools/og-template.html to /og.png (1200×630) with the Puppeteer used by the other tools.
//   NODE_PATH=<dir with puppeteer> node tools/render-og.mjs
// No WebGL involved: the template is plain HTML + inline SVG, so the output is deterministic.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer");
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..", "og.png");
const { serve } = require("./serve.js");
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
// 1) a real view of the Norway tower from the exhibit, UI hidden, cropped around the tower → tools/og-tower.png
{
  const srv = await serve(path.join(here, ".."));
  const p = await browser.newPage(); await p.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 1 });
  await p.goto(srv.url + "/index.html?nointro&debug&quality=high", { waitUntil: "load", timeout: 180000 });
  await p.waitForFunction(() => document.body.classList.contains("ready") && window.__exhibit, { timeout: 180000 });
  await p.addStyleTag({ content: "#title,#hint,#credit,#legend,#controls,#nav,#panel,#powerKey,#tip,#toast,#placeholder{display:none!important}" });
  await p.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await p.evaluate(() => { const { scene: S, view, DATA } = window.__exhibit; S.resize(); S.flyTo(DATA.countries.find(c => c.iso === "NO"), 1.62, 0.26); view.lastInteract = performance.now() + 1e9; });
  await p.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  const c = await p.evaluate(() => { const { scene: S, DATA } = window.__exhibit; const t = DATA.countries.find(c => c.iso === "NO")._tower; const v = t.pos.clone().addScaledVector(t.normal, t.n*t.dims.h*0.5).applyQuaternion(S.world.quaternion); S.toScreen(v); return { x: v.x, y: v.y }; });
  const size = 720, x = Math.max(0, Math.min(1200 - size, Math.round(c.x - size/2))), y = Math.max(0, Math.min(1200 - size, Math.round(c.y - size/2)));
  await p.screenshot({ path: path.join(here, "og-tower.png"), clip: { x, y, width: size, height: size } });
  console.log("wrote tools/og-tower.png (Norway tower at", Math.round(c.x), Math.round(c.y), ")");
  await p.close(); srv.close();
}
// 2) the card itself
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto("file://" + path.join(here, "og-template.html"), { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log("wrote " + out);
