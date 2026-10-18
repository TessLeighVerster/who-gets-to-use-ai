#!/usr/bin/env node
// How soon is the intro usable on a slow phone? Emulates Lighthouse's "Slow 4G" (1.6 Mbps down, 750 kbps up, 150 ms RTT)
// and 4x CPU slowdown on a 390×844 phone, loads the page and reports when #introGo is wired (data-ready="1"),
// when the first click on it is handled, and when the 3D scene replaced the placeholder (body.ready).
//   NODE_PATH=<dir with puppeteer> node tools/intro-perf.mjs [--runs=3] [--width=360]
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer"); const { serve } = require("./serve.js");
const opt = Object.fromEntries(process.argv.filter(a => a.startsWith("--")).map(a => a.slice(2).split("=")));
const runs = +(opt.runs || 3), width = +(opt.width || 390);
const srv = await serve(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 300000, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const rows = [];
for (let i = 0; i < runs; i++){
  const page = await browser.newPage();
  await page.setViewport({ width, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.setCacheEnabled(false);
  const cdp = await page.target().createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const t0 = Date.now();
  await page.goto(srv.url + "/index.html?intro=1", { waitUntil: "domcontentloaded", timeout: 120000 });
  const dcl = Math.round(await page.evaluate(() => performance.getEntriesByType("navigation")[0].domContentLoadedEventStart));
  await page.waitForFunction(() => document.getElementById("introGo")?.dataset.ready === "1", { timeout: 60000, polling: 50 });
  const wired = Math.round(await page.evaluate(() => performance.getEntriesByName("intro-wired")[0].startTime));   // from navigation start, recorded by js/intro.js itself
  const heroText = await page.$eval("#heroStat", e => e.textContent.replace(/\s+/g, " ").trim());
  const cta = await page.$eval("#introGo", e => e.textContent);
  await page.waitForFunction(() => document.body.classList.contains("ready"), { timeout: 120000, polling: 100 });
  const sceneReady = Math.round(await page.evaluate(() => performance.now()));
  rows.push({ dcl, wired, sceneReady, cta, heroText });
  await page.close();
}
await browser.close(); srv.close();
console.log(`Slow 4G + 4x CPU, ${width}×844 @3x, ${runs} run(s) (software WebGL, so sceneReady is pessimistic)`);
console.log("run  DOMContentLoaded  intro interactive  3D scene ready");
rows.forEach((r, i) => console.log(`${String(i + 1).padEnd(5)}${String(r.dcl + " ms").padEnd(17)}${String(r.wired + " ms").padEnd(18)}${r.sceneReady} ms`));
console.log(`CTA label: "${rows[0].cta}" · hero: "${rows[0].heroText}"`);
