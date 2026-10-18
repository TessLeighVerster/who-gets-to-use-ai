#!/usr/bin/env node
// Frame-time profile on a throttled phone profile (4x CPU, 390×844 @3x, headless Chrome with software WebGL):
// default view, max zoom on Europe (densest cluster) and the panel open, plus draw calls, triangles and texture memory.
//   NODE_PATH=<dir with puppeteer> node tools/perf-profile.mjs [--quality=low|high] [--frames=120] [--label=before]
// Software WebGL makes absolute frame times pessimistic; compare runs with each other, not with a real GPU.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer"); const { serve } = require("./serve.js");
const opt = Object.fromEntries(process.argv.filter(a => a.startsWith("--")).map(a => a.slice(2).split("=")));
const FRAMES = +(opt.frames || 120);
const srv = await serve(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const cdp = await page.target().createCDPSession(); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.goto(srv.url + "/index.html?nointro&debug" + (opt.quality ? "&quality=" + opt.quality : ""), { waitUntil: "load", timeout: 180000 });
await page.waitForFunction(() => document.body.classList.contains("ready") && window.__exhibit, { timeout: 180000 });
const settle = async (ms = 2500) => { await page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
await settle(4000);   // let the towers finish building
const measure = () => page.evaluate(async (N) => {
  const { scene: S } = window.__exhibit, r = S.renderer;
  // time the whole frame interval and the render() call separately
  const orig = r.render.bind(r); let renderMs = 0; r.render = (a, b) => { const t = performance.now(); orig(a, b); renderMs += performance.now() - t; };
  const dts = []; let last = performance.now(), n = 0;
  await new Promise(res => { const tick = () => { const now = performance.now(); dts.push(now - last); last = now; if (++n >= N) res(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  r.render = orig;
  dts.shift(); dts.sort((a, b) => a - b);
  const mean = dts.reduce((a, b) => a + b, 0) / dts.length, p50 = dts[Math.floor(dts.length / 2)], p95 = dts[Math.floor(dts.length * 0.95)];
  // texture memory: walk the materials and count each texture once
  const seen = new Set(); let bytes = 0;
  S.scene.traverse(o => { const mats = o.material ? [].concat(o.material) : []; for (const m of mats){ for (const k of Object.keys(m)){ const t = m[k]; if (t && t.isTexture && !seen.has(t.uuid)){ seen.add(t.uuid); const img = t.image || {}; const w = img.width || 0, h = img.height || 0; bytes += w * h * 4 * (t.generateMipmaps ? 1.333 : 1); } } if (m.uniforms) for (const u of Object.values(m.uniforms)){ const t = u.value; if (t && t.isTexture && !seen.has(t.uuid)){ seen.add(t.uuid); const img = t.image || {}; bytes += (img.width || 0) * (img.height || 0) * 4 * (t.generateMipmaps ? 1.333 : 1); } } } });
  return { frameMs: { mean: +mean.toFixed(1), p50: +p50.toFixed(1), p95: +p95.toFixed(1) }, renderMs: +(renderMs / N).toFixed(1), calls: r.info.render.calls, triangles: r.info.render.triangles, textures: seen.size, textureMB: +(bytes / 1e6).toFixed(2), geometries: r.info.memory.geometries };
}, FRAMES);
const rows = [];
// 1) default view
await page.evaluate(() => { const { scene: S, view } = window.__exhibit; S.resetView(); view.lastInteract = performance.now(); }); await settle(3000);
rows.push(["default view", await measure()]);
// 2) max zoom on Europe (Germany at minDist)
await page.evaluate(() => { const { scene: S, view, DATA } = window.__exhibit; S.flyTo(DATA.countries.find(c => c.iso === "DE"), view.minDist, 0.2); }); await settle(3500);
rows.push(["max zoom, Europe", await measure()]);
// 3) panel open (South Africa selected, sheet open)
await page.evaluate(() => { const { panel: P, DATA } = window.__exhibit; P.select(DATA.countries.find(c => c.iso === "ZA")); }); await settle(3500);
rows.push(["panel open (ZA)", await measure()]);
const q = await page.evaluate(() => (window.__exhibit.scene.quality && window.__exhibit.scene.quality.tier) || "n/a");
await browser.close(); srv.close();
console.log(`${opt.label || ""} quality=${q} · 4x CPU, 390×844 @3x, ${FRAMES} frames each (software WebGL)`);
console.log("scenario".padEnd(20) + "frame ms mean/p50/p95".padEnd(26) + "render() ms".padEnd(13) + "draw calls".padEnd(12) + "triangles".padEnd(12) + "textures (MB)");
for (const [k, m] of rows) console.log(k.padEnd(20) + `${m.frameMs.mean} / ${m.frameMs.p50} / ${m.frameMs.p95}`.padEnd(26) + String(m.renderMs).padEnd(13) + String(m.calls).padEnd(12) + String(m.triangles).padEnd(12) + `${m.textures} (${m.textureMB})`);
