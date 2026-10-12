// Mobile audit harness: loads the exhibit at phone/tablet sizes with touch emulation,
// screenshots each, reports element rectangles, overlaps and viewport overflow, and
// exercises tap / drag / pinch through CDP touch events.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const FILE = process.argv[2] || "/Users/admin/who-gets-to-use-ai/index.html";
const OUT = process.argv[3] || path.join(__dirname, "shots");
fs.mkdirSync(OUT, { recursive: true });

const DEVICES = [
  { name: "iphone-se",     w: 375, h: 667, dpr: 2, mobile: true },
  { name: "iphone-14",     w: 390, h: 844, dpr: 3, mobile: true },
  { name: "pixel-7",       w: 412, h: 915, dpr: 2.6, mobile: true },
  { name: "galaxy-s8",     w: 360, h: 740, dpr: 3, mobile: true },
  { name: "iphone-14-land",w: 844, h: 390, dpr: 3, mobile: true },
  { name: "ipad-portrait", w: 768, h: 1024, dpr: 2, mobile: true },
  { name: "ipad-land",     w: 1024, h: 768, dpr: 2, mobile: true },
];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const sleep = ms => new Promise(r => setTimeout(r, ms));

function rectsScript() {
  const ids = ["#title", "#ticker", "#controls", "#powerKey", "#nav", "#panel", "#panel .head", "#credit", "#legend", "#intro .ibox", "#hint"];
  const vis = el => { const cs = getComputedStyle(el); return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05; };
  const out = {};
  for (const id of ids) { const el = document.querySelector(id); if (!el) continue; const r = el.getBoundingClientRect(); out[id] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), visible: vis(el) && r.width > 0 }; }
  out._vp = { w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight };
  // small tap targets among visible interactive elements
  out._small = [...document.querySelectorAll("button, a, input, .row")].filter(el => { const r = el.getBoundingClientRect(); return vis(el) && r.width > 0 && (r.width < 36 || r.height < 36) && el.closest("#intro") === null; }).map(el => { const r = el.getBoundingClientRect(); return (el.id ? "#" + el.id : el.className ? "." + String(el.className).split(" ")[0] : el.tagName) + " " + Math.round(r.width) + "x" + Math.round(r.height); }).slice(0, 25);
  return out;
}
function overlaps(a, b) { return a.visible && b.visible && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
function report(name, R) {
  const issues = [];
  const keys = Object.keys(R).filter(k => !k.startsWith("_"));
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = keys[i], b = keys[j]; if (a.startsWith(b) || b.startsWith(a) || (a === "#title" && b === "#ticker")) continue;
    if (overlaps(R[a], R[b])) issues.push(`overlap ${a} × ${b}`);
  }
  for (const k of keys) { const r = R[k]; if (!r.visible || k === "#panel") continue; if (r.x < 0 || r.y < 0 || r.x + r.w > R._vp.w + 1 || r.y + r.h > R._vp.h + 1) issues.push(`offscreen ${k} (${r.x},${r.y} ${r.w}x${r.h})`); }
  if (R._vp.scrollW > R._vp.w || R._vp.scrollH > R._vp.h) issues.push(`page overflows viewport ${R._vp.scrollW}x${R._vp.scrollH}`);
  if (R._small.length) issues.push(`small targets: ${R._small.join(", ")}`);
  console.log(`\n== ${name}`); for (const k of keys) console.log(`   ${k.padEnd(14)} ${JSON.stringify(R[k])}`);
  console.log(issues.length ? "   ISSUES:\n   - " + issues.join("\n   - ") : "   no layout issues");
  return issues;
}

const sessions = new WeakMap();
async function touch(page, type, points) {
  let cdp = sessions.get(page); if (!cdp) { cdp = await page.target().createCDPSession(); sessions.set(page, cdp); }
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
}
async function tapAt(page, x, y) { await touch(page, "touchStart", [{ x, y }]); await sleep(60); await touch(page, "touchEnd", []); }
async function dragTouch(page, from, to, steps = 12) {
  await touch(page, "touchStart", [from]); for (let i = 1; i <= steps; i++) { await touch(page, "touchMove", [{ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }]); await sleep(16); } await touch(page, "touchEnd", []);
}
async function pinch(page, cx, cy, d0, d1, steps = 12) {
  const pts = d => [{ x: cx - d / 2, y: cy }, { x: cx + d / 2, y: cy }];
  await touch(page, "touchStart", [pts(d0)[0]]); await touch(page, "touchStart", pts(d0));
  for (let i = 1; i <= steps; i++) { await touch(page, "touchMove", pts(d0 + (d1 - d0) * i / steps)); await sleep(16); }
  await touch(page, "touchEnd", [pts(d1)[0]]); await touch(page, "touchEnd", []);
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 300000, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const all = {};
  const only = (process.argv[4] || "").split(",").filter(Boolean);
  for (const d of DEVICES) {
    if (only.length && !only.includes(d.name)) continue;
    const page = await browser.newPage();
    const logs = [];
    page.on("pageerror", e => logs.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() === "error") logs.push("console: " + m.text()); });
    await page.emulate({ viewport: { width: d.w, height: d.h, deviceScaleFactor: d.dpr, isMobile: d.mobile, hasTouch: true, isLandscape: d.w > d.h }, userAgent: UA });
    // intro first
    await page.goto("file://" + FILE, { waitUntil: "load", timeout: 90000 }); await sleep(2500);
    await page.screenshot({ path: `${OUT}/${d.name}-0-intro.png` });
    const introR = await page.evaluate(rectsScript);
    const introIssues = []; const ib = introR["#intro .ibox"]; if (ib && (ib.y < 0 || ib.y + ib.h > d.h)) introIssues.push(`intro box offscreen (${ib.y}..${ib.y + ib.h} of ${d.h})`);
    await page.goto("file://" + FILE + "?nointro", { waitUntil: "load", timeout: 90000 }); await sleep(3500);
    await page.screenshot({ path: `${OUT}/${d.name}-1-idle.png` });
    const R = await page.evaluate(rectsScript);
    const issues = [...introIssues, ...report(d.name, R)];
    // Power layer on → powerKey visible
    await page.evaluate(() => setLayer("power")); await sleep(600);
    await page.screenshot({ path: `${OUT}/${d.name}-2-power.png` });
    const R2 = await page.evaluate(rectsScript); const i2 = report(d.name + " (power layer)", R2); issues.push(...i2.map(s => "power: " + s));
    await page.evaluate(() => setLayer("none"));
    // gestures on canvas: drag rotates, pinch zooms, tap selects
    const narrow = (d.w < d.h && d.w <= 900) || d.w <= 600;
    const P = R["#panel"]; const sheetTop = narrow && P ? P.y : d.h; const mainRight = !narrow && P ? P.x : d.w;
    const cy = narrow ? Math.min(sheetTop - 40, d.h * 0.5) : d.h * 0.5, cx = mainRight * 0.5;
    const yaw0 = await page.evaluate(() => view.tYaw);
    await dragTouch(page, { x: cx - 60, y: cy }, { x: cx + 60, y: cy }); await sleep(300);
    const yaw1 = await page.evaluate(() => view.tYaw);
    if (Math.abs(yaw1 - yaw0) < 0.05) issues.push("one-finger drag did not rotate");
    const dist0 = await page.evaluate(() => view.tDist);
    await pinch(page, cx, cy, 80, 200); await sleep(300);
    const dist1 = await page.evaluate(() => view.tDist);
    if (!(dist1 < dist0 - 0.05)) issues.push(`pinch-out did not zoom in (${dist0.toFixed(2)} → ${dist1.toFixed(2)})`);
    const yawAfterPinch = await page.evaluate(() => view.tYaw);
    if (Math.abs(yawAfterPinch - yaw1) > 0.05) issues.push(`pinch changed the rotation by ${(yawAfterPinch - yaw1).toFixed(2)} rad (jump after lifting a finger)`);
    // tap a tower: pick the tallest tower whose top is on screen in the canvas area
    await page.evaluate(() => { view.tDist = view.dist = view.maxDist; view.tPanX = view.tPanY = view.panX = view.panY = 0; applyView(); });
    await sleep(800);
    const tgt = await page.evaluate((top, right) => {
      const v = new THREE.Vector3(); let best = null;
      for (const t of towers) { if (t.v < 1 || t.isCity) continue; v.copy(t.pos).addScaledVector(t.normal, Math.min(t.v, t.n) * t.dims.h * 0.5).applyQuaternion(world.quaternion); const n = v.clone().normalize(); const camDir = camera.position.clone().normalize(); if (n.dot(camDir) < 0.35) continue; toScreen(v); if (v.y > top - 20 || v.y < 120 || v.x > right - 20) continue; if (!best || t.v > best.v) best = { x: v.x, y: v.y, v: t.v, name: t.ref.name }; }
      return best;
    }, sheetTop, mainRight);
    if (tgt) {
      await tapAt(page, tgt.x, tgt.y); await sleep(1200);
      const sel = await page.evaluate(() => state.selected && state.selected.name);
      if (sel !== tgt.name) issues.push(`tap on ${tgt.name} tower selected "${sel}"`);
      const open = await page.evaluate(() => document.body.classList.contains("sheet-open"));
      await page.screenshot({ path: `${OUT}/${d.name}-3-selected.png` });
      const R3 = await page.evaluate(rectsScript); const i3 = report(d.name + " (country selected)", R3); issues.push(...i3.map(s => "selected: " + s));
      if (narrow && !open) issues.push("sheet did not open on selection");
      // tap empty space in the canvas above the sheet: should it collapse the sheet?
      const R3p = R3["#panel"]; const ey = Math.max(60, (R3p ? R3p.y : d.h) - 30);
      await tapAt(page, 20, ey); await sleep(500);
      const after = await page.evaluate(() => ({ sel: !!state.selected, open: document.body.classList.contains("sheet-open"), strip: document.querySelector("#panel").classList.contains("strip") }));
      console.log("   after tapping empty globe:", JSON.stringify(after));
      if (narrow && after.open) issues.push("tapping the empty globe leaves the sheet covering the globe");
    } else issues.push("no tower top found on screen to tap");
    // swipe the sheet head down (should collapse) and up (should open)
    if (narrow) {
      await page.evaluate(() => { document.querySelector("#panel").classList.remove("strip"); syncSheet(); }); await sleep(400);
      const head = await page.evaluate(() => { const r = document.querySelector("#panel .head").getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; });
      await dragTouch(page, head, { x: head.x, y: head.y + 160 }); await sleep(500);
      const strip = await page.evaluate(() => document.querySelector("#panel").classList.contains("strip"));
      if (!strip) issues.push("swipe-down on sheet header did not collapse it");
      await page.screenshot({ path: `${OUT}/${d.name}-4-after-swipe.png` });
    }
    if (logs.length) issues.push(...logs.slice(0, 5));
    all[d.name] = issues;
    console.log(`   >>> ${d.name} gesture/layout issues: ${issues.length ? "\n   - " + issues.join("\n   - ") : "none"}`);
    await page.close().catch(() => {});
  }
  await browser.close();
  console.log("\n\n==== SUMMARY ====");
  for (const [k, v] of Object.entries(all)) { console.log(`${k}: ${v.length ? "" : "OK"}`); v.forEach(s => console.log("   - " + s)); }
})().catch(e => { console.error(e); process.exit(1); });
