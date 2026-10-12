// Tap every visible country tower at its on-screen midpoint and check the selection, across view states.
const puppeteer = require("puppeteer");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FILE = process.argv[2] || "/Users/admin/who-gets-to-use-ai/index.html";
const W = +(process.argv[3] || 390), H = +(process.argv[4] || 844), touch = (process.argv[5] || "touch") === "touch", DPR = +(process.argv[6] || 1);
(async () => {
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 300000, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const page = await browser.newPage();
  await page.emulate({ viewport: { width: W, height: H, deviceScaleFactor: DPR, isMobile: touch, hasTouch: touch }, userAgent: touch ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36" });
  await page.goto("file://" + FILE + "?nointro", { waitUntil: "load", timeout: 90000 }); await sleep(3500);
  const cdp = await page.target().createCDPSession();
  const tap = async (x, y) => { if (touch) { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 0 }] }); await sleep(60); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); } else { await page.mouse.click(x, y); } };
  const states = [
    { name: "opening view", set: "" },
    { name: "Asia, zoomed out", set: "view.tYaw = view.yaw = -105*deg; view.tPitch = view.pitch = 0;" },
    { name: "Asia, zoomed in", set: "view.tYaw = view.yaw = -105*deg; view.tPitch = view.pitch = 0; view.tDist = view.dist = view.minDist*1.3;" },
    { name: "Europe, tilted", set: "view.tYaw = view.yaw = -15*deg; view.tPitch = view.pitch = 40*deg;" },
  ];
  let total = 0, wrong = 0;
  const setState = async st => { await page.evaluate(s => { select(null, true); document.querySelector("#panel").classList.add("strip"); syncSheet(); view.tPanX = view.tPanY = view.panX = view.panY = 0; view.autoPan = false; view.restoreDist = 0; view.tDist = view.dist = view.maxDist; view.tPitch = view.pitch = 6*deg; view.tYaw = view.yaw = -20*deg; eval(s); view.flying = false; view.yawVel = view.pitchVel = 0; view.lastInteract = performance.now() + 1e9; applyView(); }, st.set); };
  // screen points along one tower, computed right now
  const pointsOf = name => page.evaluate(name => {
    const t = towers.find(t => t.ref.name === name && !t.isCity); if (!t) return null;
    const v = new THREE.Vector3().copy(t.pos).applyQuaternion(world.quaternion), n = new THREE.Vector3().copy(t.normal).applyQuaternion(world.quaternion);
    if (n.dot(camera.position.clone().sub(v)) <= 0) return null;
    const pr = document.querySelector("#panel").getBoundingClientRect(), narrow = isNarrow(), len = Math.min(t.v, t.n) * t.dims.h, pts = [];
    const bottom = narrow ? pr.top - 8 : innerHeight - 8, right = narrow ? innerWidth - 8 : pr.left - 8;
    for (const f of [0.25, 0.5, 0.8]) { const p = v.clone().addScaledVector(n, len * f); toScreen(p); pts.push([Math.round(p.x), Math.round(p.y)]); }
    if (pts.some(([x, y]) => x < 8 || x > right || y < 8 || y > bottom)) return null;
    return pts;
  }, name);
  for (const st of states) {
    await setState(st); await sleep(600);
    const names = await page.evaluate(() => towers.filter(t => t.v >= 0.5 && !t.isCity && !t.ref.isContinent).map(t => t.ref.name));
    let testable = 0; const miss = [];
    for (const name of names) {
      const pts = await pointsOf(name); if (!pts) continue; testable++;
      for (const [x, y] of pts) {
        const cast = await page.evaluate((x, y) => { const h = castAt(x, y); return h ? (h.type === "tower" ? h.t.ref.name : "dc:" + h.d.name) : null; }, x, y);
        await tap(x, y); await sleep(120);
        const sel = await page.evaluate(() => state.selected ? state.selected.name : state.selectedDC ? "dc:" + state.selectedDC.name : null);
        total++; if (sel !== name) { wrong++; miss.push(`   ✗ ${name.padEnd(22)} tap(${x},${y}) -> ${sel}  [exact cast: ${cast}]`); }
        await setState(st); await sleep(80);
      }
    }
    console.log(`\n== ${st.name}: ${testable} towers testable, ${miss.length} wrong taps`); miss.forEach(m => console.log(m));
  }
  console.log(`\n${wrong}/${total} taps selected something other than the tower under the finger`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
