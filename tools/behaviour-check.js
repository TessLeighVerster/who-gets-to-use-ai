// Behaviour snapshot for the exhibit, used to prove a refactor changed nothing the user can see.
//   node tools/behaviour-check.js <out.json> [baseline.json]
// Serves the repo root over HTTP, drives the page in headless Chrome and records what the DOM shows after:
// the intro, dismissing it, selecting South Africa (card values), switching tabs, toggling the Power and
// Data-cost layers, and resetView. With a baseline it diffs the two snapshots and exits 1 on any difference.
// Run with NODE_PATH pointing at a node_modules that contains puppeteer.
const puppeteer = require("puppeteer"), fs = require("fs"), path = require("path");
const { serve } = require("./serve");
const OUT = process.argv[2] || "behaviour.json", BASE = process.argv[3];

(async () => {
  const srv = await serve(process.env.ROOT || path.join(__dirname, ".."));   // ROOT=<dir> checks another copy of the site (e.g. the committed version)
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 300000, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("requestfailed", r => errors.push("request failed: " + r.url()));
  const frames = (n = 3) => page.evaluate(n => new Promise(r => { const f = k => k ? requestAnimationFrame(() => f(k - 1)) : r(); f(n); }), n);
  const txt = sel => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, " ").trim()));
  const one = sel => page.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
  const cls = sel => page.$eval(sel, e => [...e.classList].sort().join(" ")).catch(() => null);
  const activeView = () => page.$eval(".view.active", e => e.id).catch(() => null);
  const activeTab = () => page.$eval(".tab.active", e => e.dataset.tab).catch(() => null);
  const snap = {};

  // 1) intro
  await page.goto(srv.url + "/index.html", { waitUntil: "load", timeout: 90000 });
  // read the intro soon after load (it fades in after 0.2 s and dismisses itself after 9.4 s; the first software-rendered frames are slow)
  await new Promise(r => setTimeout(r, 500));
  snap.intro = {
    present: !!(await page.$("#intro")), bodyHasIntroClass: await page.$eval("body", b => b.classList.contains("intro")),
    visible: await page.$eval("#intro", e => getComputedStyle(e).display !== "none" && getComputedStyle(e).animationName === "introIn"),   // fade-in is time based, so check that it is scheduled rather than how far it has got
    h2: await one("#intro h2"), lead: await one("#intro .lead"), how: await one("#intro .how"), go: await one("#introGo"),
    buttons: await txt("#intro .try button"), canvasSize: await page.$eval("#scene", c => [c.width, c.height]),
  };
  await page.$eval("#introGo", e => e.click()).catch(() => null);   // on a slow software-GL load the 9.4 s timer may already have dismissed it
  await new Promise(r => setTimeout(r, 700)); await frames(3);
  snap.afterIntro = { introRemoved: !(await page.$("#intro")), bodyHasIntroClass: await page.$eval("body", b => b.classList.contains("intro")) };

  // 2) static panel contents
  snap.lists = {
    usageRows: (await txt("#usageList .row")).length, usageTop5: (await txt("#usageList .row")).slice(0, 5), usageSub: await one("#v-usage p.sub"),
    accessMost: await txt("#accessMost .row"), accessLeast: await txt("#accessLeast .row"), formula: await one("#accessFormula"),
    legendProviders: await txt("#lg-prov li"), legendOperators: await txt("#lg-op li"), keyTab: await txt("#v-key .keywrap li"),
    spendList: await txt("#spendList li"), spendStack: await page.$$eval("#spendStack i", els => els.map(e => e.getAttribute("style"))),
    hint: await one("#hint"), credit: await one("#credit"), tickerLabel: await one("#ticker .l"),
  };
  await page.type("#search", "Lagos"); await frames(1);
  snap.search = { dcRows: await txt("#searchDC .row"), visibleCountries: await page.$$eval("#usageList .row", els => els.filter(e => e.style.display !== "none").map(e => e.dataset.iso)), bodySearching: await page.$eval("body", b => b.classList.contains("searching")) };
  await page.$eval("#search", e => { e.value = ""; e.dispatchEvent(new Event("input", { bubbles: true })); }); await frames(1);

  // 3) select ZA from the list
  await page.click('#usageList .row[data-iso="ZA"]'); await frames(3);
  const card = async () => ({
    activeView: await activeView(), h2: await one("#v-card h2"), cont: await one("#v-card .cont"),
    stats: await page.$$eval("#v-card .stat", els => els.map(e => [e.querySelector(".n").textContent.trim(), e.querySelector(".l").textContent.trim()])),
    bricks: await page.$$eval("#v-card .bricks .brick", els => els.map(e => e.getAttribute("style") + "|" + e.title)), blegend: await txt("#v-card .blegend span"),
    cities: await txt("#v-card .cities .row"), buys: await one("#v-card .buys"), routes: await txt("#v-card .routes li"),
    caps: await txt("#v-card .caps li"), bars: await txt("#v-card .bars li"), notes: await txt("#v-card .facts:not(.caps):not(.bars):not(.routes) li"),
    actions: await txt("#v-card .actions button"), selectedRows: await page.$$eval(".row.sel", els => els.map(e => e.dataset.iso)),
    panelClasses: await cls("#panel"), bodyClasses: await cls("body"),
  });
  snap.za = await card();
  // pin, then unpin
  await page.click("#pinBtn"); await frames(1);
  snap.pin = { pinsShown: await page.$eval("#pins", e => e.classList.contains("show")), svgTexts: await txt("#pinsvg text"), pinBtn: await one("#pinBtn") };
  await page.click("#pinBtn"); await frames(1);
  snap.unpin = { pinsShown: await page.$eval("#pins", e => e.classList.contains("show")), pinBtn: await one("#pinBtn") };

  // 4) tabs (clicking a tab closes the card first; the Key tab is display:none on desktop, so the click is dispatched)
  snap.tabs = {};
  for (const t of ["spend", "access", "key", "usage"]){ await page.$eval(`.tab[data-tab="${t}"]`, e => e.click()); await frames(1); snap.tabs[t] = { view: await activeView(), tab: await activeTab(), selectedRows: (await page.$$("#usageList .row.sel")).length }; }

  // 5) layers
  const layer = async () => ({ keyClasses: await cls("#powerKey"), keyHTML: await page.$eval("#powerKey", e => e.innerHTML), segOn: await page.$$eval("#layerSeg button", els => els.filter(e => e.classList.contains("on")).map(e => e.dataset.layer)) });
  snap.layers = {};
  await page.click('#layerSeg button[data-layer="power"]'); await frames(1); snap.layers.power = await layer();
  await page.click('#layerSeg button[data-layer="data"]'); await frames(1); snap.layers.data = await layer();
  await page.click('#powerKey [data-mode="dataShare"]'); await frames(1); snap.layers.dataShare = await layer();
  await page.click("#keyToggle"); await frames(1); snap.layers.collapsed = await cls("#powerKey");
  await page.click("#keyToggle"); await frames(1);
  await page.click('#layerSeg button[data-layer="none"]'); await frames(1); snap.layers.none = await layer();
  // keyboard shortcuts for the same layers
  await page.keyboard.press("p"); await frames(1); snap.layers.keyP = (await layer()).segOn;
  await page.keyboard.press("p"); await page.keyboard.press("d"); await frames(1); snap.layers.keyD = (await layer()).segOn;
  await page.keyboard.press("d"); await frames(1);

  // 6) continents toggle and back
  await page.click("#contToggle"); await frames(2); snap.continents = { pressed: await page.$eval("#contToggle", e => e.getAttribute("aria-pressed")), on: await page.$eval("#contToggle", e => e.classList.contains("on")) };
  await page.click("#contToggle"); await frames(2);

  // 7) resetView after a selection: card closes, list view returns, globe flies to its home heading (compass settles at -58°)
  await page.click('#usageList .row[data-iso="ZA"]'); await frames(3);
  const beforeReset = { view: await activeView(), compass: await page.$eval("#compass", e => e.style.transform) };
  await page.click("#navFit");
  let compass = "", i = 0;
  for (; i < 400; i++){ await frames(1); compass = await page.$eval("#compass", e => e.style.transform); if (compass === "rotate(-58deg)") break; }
  snap.reset = { beforeView: beforeReset.view, afterView: await activeView(), selectedRows: (await page.$$(".row.sel")).length, compass, pinBtnGone: !(await page.$("#pinBtn")) };

  // 8) counters run, sound toggle, ticker hide
  snap.live = { promptsNonZero: (await one("#prompts")) !== "0", spendTotalFormat: /^\$[\d,.]+( [MB])?$/.test(await one("#spendTotal")) };
  await page.click("#soundToggle"); snap.sound = { pressedAfterClick: await page.$eval("#soundToggle", e => e.getAttribute("aria-pressed")) }; await page.click("#soundToggle");
  snap.ticker = { hiddenByDefault: await page.$eval("body", b => b.classList.contains("noticker")) };
  await page.click("#tickerShow"); snap.ticker.shownAfterToggle = !(await page.$eval("body", b => b.classList.contains("noticker"))); await page.click("#tickerHide");

  // 9) ?nointro
  await page.goto(srv.url + "/index.html?nointro", { waitUntil: "load", timeout: 90000 }); await frames(3); await new Promise(r => setTimeout(r, 600));
  snap.nointro = { introRemoved: !(await page.$("#intro")), bodyHasIntroClass: await page.$eval("body", b => b.classList.contains("intro")) };

  snap.errors = errors;
  await browser.close(); srv.close();
  fs.writeFileSync(OUT, JSON.stringify(snap, null, 1));
  const lines = [];
  lines.push(`intro renders: ${snap.intro.present && snap.intro.visible ? "ok" : "FAIL"} (“${snap.intro.h2}”, ${snap.intro.buttons.length} example buttons)`);
  lines.push(`ZA card: ${snap.za.h2 === "South Africa" && snap.za.activeView === "v-card" ? "ok" : "FAIL"} · stats ${snap.za.stats.map(s => s[0]).join(" / ")}`);
  lines.push(`tabs: ${Object.entries(snap.tabs).map(([k, v]) => k + "→" + v.view).join(", ")}`);
  lines.push(`layers: power key ${snap.layers.power.keyClasses}, data ${snap.layers.data.segOn}, % of income mode ${snap.layers.dataShare.keyHTML.includes('data-mode="dataShare" class="on"') ? "on" : "FAIL"}, off ${snap.layers.none.keyClasses}`);
  lines.push(`resetView: ${snap.reset.afterView === "v-usage" && snap.reset.compass === "rotate(-58deg)" ? "ok" : "FAIL"} (card closed, compass ${snap.reset.compass} after ${i} frames)`);
  lines.push(`?nointro: ${snap.nointro.introRemoved && !snap.nointro.bodyHasIntroClass ? "ok" : "FAIL"}`);
  lines.push(`page errors: ${errors.length}`);
  errors.forEach(e => lines.push("  " + e));
  console.log(lines.join("\n"));
  if (BASE){
    const base = JSON.parse(fs.readFileSync(BASE, "utf8"));
    const diffs = [];
    const walk = (a, b, p) => {
      if (typeof a !== "object" || a === null || typeof b !== "object" || b === null){ if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${p}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`); return; }
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p + "." + k);
    };
    walk(base, snap, "");
    console.log(diffs.length ? `\n${diffs.length} difference(s) from ${BASE}:\n` + diffs.map(d => "  " + d).join("\n") : `\nidentical to ${BASE} (${JSON.stringify(snap).length} bytes of observed state compared)`);
    if (diffs.length) process.exit(1);
  }
  if (errors.length) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
