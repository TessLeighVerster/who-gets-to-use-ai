#!/usr/bin/env node
// Screenshots of the globe at the default view, zoomed on Europe and zoomed on Africa, at desktop and 390px.
//   NODE_PATH=<dir with puppeteer> node tools/view-shots.mjs <name> [--quality=low|high]
// Writes tools/shots/<name>-{default,europe,africa}-{desktop,phone}.png
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer"); const { serve } = require("./serve.js");
const here = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv.slice(2).find(a => !a.startsWith("--")) || "view";
const opt = Object.fromEntries(process.argv.filter(a => a.startsWith("--")).map(a => a.slice(2).split("=")));
const srv = await serve(path.join(here, ".."));
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
for (const [tag, vp] of [["desktop", { width: 1440, height: 900, deviceScaleFactor: 1 }], ["phone", { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]]){
  const page = await browser.newPage(); await page.setViewport(vp);
  await page.goto(srv.url + "/index.html?nointro&debug" + (opt.quality ? "&quality=" + opt.quality : ""), { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => document.body.classList.contains("ready") && window.__exhibit, { timeout: 180000 });
  const settle = async ms => { await page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  await settle(4000);
  const shot = async v => { await page.screenshot({ path: path.join(here, "shots", `${name}-${v}-${tag}.png`) }); console.log("wrote", `tools/shots/${name}-${v}-${tag}.png`); };
  await page.evaluate(() => { const { view } = window.__exhibit; view.lastInteract = performance.now() + 1e9; }); await settle(500); await shot("default");   // freeze auto-rotate
  await page.evaluate(() => { const { scene: S, view, DATA } = window.__exhibit; S.flyTo(DATA.countries.find(c => c.iso === "DE"), view.minDist * 1.05, 0.2); view.lastInteract = performance.now() + 1e9; }); await settle(3500); await shot("europe");
  await page.evaluate(() => { const { scene: S, view, DATA } = window.__exhibit; S.flyTo(DATA.countries.find(c => c.iso === "NG"), 1.9, 0.1); view.lastInteract = performance.now() + 1e9; }); await settle(3500); await shot("africa");
  await page.close();
}
await browser.close(); srv.close();
