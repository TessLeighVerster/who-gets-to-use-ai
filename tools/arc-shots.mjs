#!/usr/bin/env node
// Screenshots of the arcs: South Africa (3 arcs, mixed operators) and the United States (dense cluster) selected, at desktop
// (panel open) and 390px (sheet open), plus the phone with the sheet tucked away.   NODE_PATH=… node tools/arc-shots.mjs <name>
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer"); const { serve } = require("./serve.js");
const here = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv.slice(2).find(a => !a.startsWith("--")) || "arcs";
const srv = await serve(path.join(here, ".."));
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
for (const [tag, vp] of [["desktop", { width: 1440, height: 900, deviceScaleFactor: 1 }], ["phone", { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]]){
  const page = await browser.newPage(); await page.setViewport(vp);
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.goto(srv.url + "/index.html?nointro&debug", { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => document.body.classList.contains("ready") && window.__exhibit, { timeout: 180000 });
  const settle = async ms => { await page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  await settle(4000);
  for (const iso of ["ZA", "US"]){
    await page.evaluate(iso => { const { panel: P, DATA, view } = window.__exhibit; P.select(DATA.countries.find(c => c.iso === iso)); view.lastInteract = performance.now() + 1e9; }, iso); await settle(4000);
    await page.screenshot({ path: path.join(here, "shots", `${name}-${iso}-${tag}.png`) }); console.log("wrote", `tools/shots/${name}-${iso}-${tag}.png`, "arcs:", await page.evaluate(() => window.__exhibit.scene.arcCount()));
    if (tag === "phone"){ await page.evaluate(() => { document.querySelector("#panel").classList.add("strip"); window.__exhibit.panel.syncSheet(); }); await settle(1500); await page.screenshot({ path: path.join(here, "shots", `${name}-${iso}-${tag}-sheet-closed.png`) }); console.log("wrote", `tools/shots/${name}-${iso}-${tag}-sheet-closed.png`); }
  }
  await page.close();
}
await browser.close(); srv.close();
