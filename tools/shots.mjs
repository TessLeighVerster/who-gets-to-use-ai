#!/usr/bin/env node
// Screenshots of the page at desktop (1440×900) and phone (390×844 @3x) sizes.
//   NODE_PATH=<dir with puppeteer> node tools/shots.mjs <name> [query] [--wait=ms] [--root=dir]
// Writes tools/shots/<name>-desktop.png and <name>-phone.png. `query` is appended to the URL (e.g. "?intro=1").
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer"); const { serve } = require("./serve.js");
const here = path.dirname(fileURLToPath(import.meta.url));
const [name = "shot", query = ""] = process.argv.slice(2).filter(a => !a.startsWith("--"));
const opt = Object.fromEntries(process.argv.filter(a => a.startsWith("--")).map(a => a.slice(2).split("=")));
const wait = +(opt.wait || 1200);
const srv = await serve(opt.root || path.join(here, ".."));
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 300000, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
for (const [tag, vp] of [["desktop", { width: 1440, height: 900, deviceScaleFactor: 1 }], ["phone", { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]]){
  const page = await browser.newPage(); await page.setViewport(vp);
  await page.goto(srv.url + "/index.html" + query, { waitUntil: "load", timeout: 120000 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await new Promise(r => setTimeout(r, wait));
  const out = path.join(here, "shots", `${name}-${tag}.png`); await page.screenshot({ path: out }); console.log("wrote", path.relative(process.cwd(), out));
  await page.close();
}
await browser.close(); srv.close();
