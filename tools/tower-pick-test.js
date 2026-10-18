// Tower picking regression test.
// Clicks (or taps) the screen-projected centre of ten country towers at three zoom levels, in two placements
// (tower centred, and tower off-centre near the limb), and asserts that the selected country's iso matches.
// Then three realistic flows: a tap right after flying to another country (sheet open on phones), a tap while
// the globe is idly auto-rotating, and a tap mid-flight. Every failure prints the production cast result and an
// independent Three.js instanced raycast (fresh matrices) so stale-matrix problems show up as a disagreement.
//
// usage: node tools/tower-pick-test.js <index.html> <width> <height> touch|mouse <deviceScaleFactor>
//   e.g. node tools/tower-pick-test.js index.html 390 844 touch 3      (iPhone 14)
//        node tools/tower-pick-test.js index.html 1440 900 mouse 2     (retina laptop)
const puppeteer = require("puppeteer");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FILE = require("path").resolve(process.argv[2] || "index.html");
const W = +(process.argv[3] || 390), H = +(process.argv[4] || 844), touch = (process.argv[5] || "touch") === "touch", DPR = +(process.argv[6] || 3);
const deg = Math.PI / 180;
const ISOS = ["US", "BR", "GB", "DE", "NG", "ZA", "IN", "SG", "JP", "AU"];
const ZOOMS = [["far", "view.maxDist"], ["mid", "lerp(view.minDist, view.maxDist, 0.45)"], ["near", "view.minDist*1.25"]];

(async () => {
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 300000, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const page = await browser.newPage();
  await page.emulate({ viewport: { width: W, height: H, deviceScaleFactor: DPR, isMobile: touch, hasTouch: touch },
    userAgent: touch ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                     : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36" });
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto("file://" + FILE + "?nointro", { waitUntil: "load", timeout: 90000 }); await sleep(3500);
  const cdp = await page.target().createCDPSession();
  const tap = async (x, y) => {
    if (touch) { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 0 }] }); await sleep(70); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
    else { await page.mouse.move(x, y); await sleep(30); await page.mouse.down(); await sleep(50); await page.mouse.up(); }
  };
  // software WebGL can take several hundred ms per frame: never trust a fixed sleep, wait until two frames have actually been drawn
  const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  // put the globe in a known state: no selection, (on phones) the sheet tucked away, the given yaw/pitch/zoom, and the camera
  // panned exactly as flyTo() pans it so the named tower sits at the centre of the free area; `slide` moves it sideways by that
  // fraction of the free width so the off-centre placement is still on screen at every zoom
  const setView = async (iso, pitchTilt, distExpr, slide) => { await page.evaluate((iso, tilt, code, slide) => {
    select(null, true); if (isNarrow()) { document.querySelector("#panel").classList.add("strip"); syncSheet(); } resize();
    view.autoPan = false; view.flying = false; view.yawVel = view.pitchVel = 0; eval(code);
    const c = DATA.countries.find(c => c.iso === iso), t = towers.find(t => t.ref.iso === iso && !t.isCity);
    view.tYaw = -c.lon*deg; view.tPitch = clamp(c.lat*deg - tilt*deg, -80*deg, 80*deg);
    view.yaw = view.tYaw; view.pitch = view.tPitch; view.dist = view.tDist;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), view.tPitch).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), view.tYaw));
    const len = Math.min(t.v, t.n) * t.dims.h, mid = latLonToVec(c.lat, c.lon, R, new THREE.Vector3()); mid.addScaledVector(mid.clone().normalize(), len*0.5).applyQuaternion(q);
    const freeW = isNarrow() ? innerWidth : document.querySelector("#panel").getBoundingClientRect().left;
    view.tPanX = view.panX = mid.x + slide*freeW*worldPerPx(); view.tPanY = view.panY = mid.y; view.lastInteract = performance.now(); applyView(); },
    iso, pitchTilt, `view.tDist = ${distExpr};`, slide || 0); await frames(); };
  // wait until the camera has stopped moving (a fly and its sheet animation can take many software frames)
  const settled = async (ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const ok = await page.evaluate(() => !view.flying && Math.abs(view.yaw-view.tYaw) < 1e-3 && Math.abs(view.pitch-view.tPitch) < 1e-3 && Math.abs(view.dist-view.tDist) < 1e-3 && Math.abs(view.panX-view.tPanX) < 1e-3 && Math.abs(view.panY-view.tPanY) < 1e-3); if (ok) break; await sleep(100); } await frames(); };
  // screen point of a tower's midpoint right now, or null when it is not visible in the free part of the canvas
  const centreOf = iso => page.evaluate(iso => {
    const t = towers.find(t => t.ref.iso === iso && !t.isCity && !t.ref.isContinent); if (!t || t.v < 0.5) return null;
    const v = new THREE.Vector3().copy(t.pos).applyQuaternion(world.quaternion), n = new THREE.Vector3().copy(t.normal).applyQuaternion(world.quaternion);
    if (n.dot(camera.position.clone().sub(v)) <= 0.05) return null;                         // tower leaning away over the limb
    const len = Math.min(t.v, t.n) * t.dims.h, p = toScreen(v.clone().addScaledVector(n, len * 0.5));
    const pr = document.querySelector("#panel").getBoundingClientRect(), narrow = isNarrow();
    const bottom = narrow ? pr.top - 10 : innerHeight - 70, right = narrow ? innerWidth - 10 : pr.left - 10;   // keep clear of the panel/sheet and the bottom controls
    if (p.x < 60 || p.x > right || p.y < 120 || p.y > bottom) return null;
    return [Math.round(p.x), Math.round(p.y)];
  }, iso);
  // what the production code and an independent fresh-matrix raycast each say is under a point
  const diagnose = (x, y) => page.evaluate((x, y) => {
    const prod = castAt(x, y), direct = castAt(x, y);
    world.updateMatrixWorld(true); camera.updateMatrixWorld(true); bricks.boundingSphere = null; bricks.computeBoundingSphere();
    const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2((x - VX) / VW * 2 - 1, -((y - VY) / VH * 2 - 1)), camera);
    const hits = rc.intersectObject(bricks, false).sort((a, b) => a.distance - b.distance);
    const globe = rc.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), R), new THREE.Vector3());
    const first = hits.find(h => !globe || h.distance <= globe.distanceTo(rc.ray.origin));
    const owner = first ? towers.find(t => first.instanceId >= t.brickStart && first.instanceId < t.brickStart + t.n) : null;
    return { prod: prod ? (prod.type === "tower" ? prod.t.ref.iso || prod.t.ref.name : "dc:" + prod.d.name) : null,
             three: owner ? (owner.ref.iso || owner.ref.name) + "#" + first.instanceId : null, dist: view.dist.toFixed(2) };
  }, x, y);

  await page.evaluate(() => {
    const orig = hitTest;
    window.__lastTap = null;
    hitTest = function (x, y) {
      const prod = orig(x, y);
      const q = world.quaternion.clone(); world.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      bricks.boundingSphere = null; bricks.computeBoundingSphere();   // the mesh's cached sphere dates from before the towers grew (all instances collapsed, radius 0), which makes three.js skip it
      const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2((x - VX) / VW * 2 - 1, -((y - VY) / VH * 2 - 1)), camera);
      dcMesh.boundingSphere = null; dcMesh.computeBoundingSphere();
      const hits = rc.intersectObjects([bricks, dcMesh], false).sort((a, b) => a.distance - b.distance);
      const globe = rc.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), R), new THREE.Vector3());
      const first = hits.find(h => !globe || h.distance <= globe.distanceTo(rc.ray.origin));
      const fresh = !first ? null : first.object === dcMesh ? "dc:" + DATA.datacentres[first.instanceId].name : (t => t ? (t.ref.iso || t.ref.name) : null)(towers.find(t => first.instanceId >= t.brickStart && first.instanceId < t.brickStart + t.n));
      window.__lastTap = { x, y, prod: prod ? (prod.type === "tower" ? prod.t.ref.iso || prod.t.ref.name : "dc:" + prod.d.name) : null,
                           fresh, instanceId: first ? first.instanceId : null, quatChanged: !world.quaternion.equals(q) };
      return prod;
    };
  });
  const lastTap = () => page.evaluate(() => { const t = window.__lastTap; window.__lastTap = null; return t; });

  let total = 0, fail = 0; const failures = [];
  const check = async (label, iso, x, y) => {
    total++;
    await tap(x, y); await frames();
    const got = await page.evaluate(() => state.selected ? state.selected.iso : state.selectedDC ? "dc:" + state.selectedDC.name : null);
    const at = await lastTap();   // what the hit-test saw at the instant of the tap
    if (at && at.prod !== at.fresh && !(at.fresh && at.prod && at.fresh !== at.prod && at.instanceId == null)) { fail++; failures.push(`  ✗ ${label}: stale-matrix check: production hit-test said ${at.prod} but a fresh instanced raycast at the same instant said ${at.fresh} (instance ${at.instanceId})`); return false; }
    if (got === iso) return true;
    fail++; const d = await diagnose(x, y);
    failures.push(`  ✗ ${label}: tapped ${iso} at (${x},${y}) → selected ${got}   [hit-test at tap time: ${at ? at.prod : "no tap registered"}, castAt now: ${d.prod}, fresh raycast now: ${d.three}, dist ${d.dist}]`);
    return false;
  };

  // 1. ten towers × three zooms × two placements
  for (const [zname, zexpr] of ZOOMS) {
    let n = 0, bad = 0;
    for (const iso of ISOS) {
      for (const [pname, slide] of [["centred", 0], ["off-centre", 0.3]]) {
        await setView(iso, 30, zexpr, slide);
        const pt = await centreOf(iso); if (!pt) continue;
        n++; if (!await check(`${zname}/${pname}`, iso, pt[0], pt[1])) bad++;
      }
    }
    console.log(`zoom ${zname.padEnd(5)}: ${n} taps, ${bad} wrong`);
  }

  // 2. after flying to a neighbour: tap SG, let the fly settle (sheet opens on phones), then tap the nearest visible other tower
  {
    await setView("SG", 30, "lerp(view.minDist, view.maxDist, 0.5)");
    const p0 = await centreOf("SG");
    if (p0 && await check("fly/first tap", "SG", p0[0], p0[1])) {
      await settled();   // fly + sheet animation done
      const next = await page.evaluate(() => {   // nearest other visible tower to the screen centre of the free area
        const cands = towers.filter(t => t.v >= 0.5 && !t.isCity && !t.ref.isContinent && t.ref.iso !== "SG").map(t => {
          const v = new THREE.Vector3().copy(t.pos).applyQuaternion(world.quaternion), n = new THREE.Vector3().copy(t.normal).applyQuaternion(world.quaternion);
          if (n.dot(camera.position.clone().sub(v)) <= 0.05) return null;
          const p = toScreen(v.clone().addScaledVector(n, Math.min(t.v, t.n) * t.dims.h * 0.5)); return { iso: t.ref.iso, x: Math.round(p.x), y: Math.round(p.y) }; }).filter(Boolean);
        const pr = document.querySelector("#panel").getBoundingClientRect(), narrow = isNarrow(), bottom = narrow ? pr.top - 10 : innerHeight - 70, right = narrow ? innerWidth - 10 : pr.left - 10;
        const ok = cands.filter(c => c.x > 60 && c.x < right && c.y > 120 && c.y < bottom);
        const cx = (60 + right) / 2, cy = (120 + bottom) / 2; ok.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)); return ok[0] || null; });
      if (next) { if (await check("fly/second tap after settle", next.iso, next.x, next.y)) console.log(`after-fly tap (sheet open): ok (SG then ${next.iso})`); } else console.log("  (no second tower visible after the fly)");
    }
  }

  // 2b. end to end: tap a tower, let the fly finish, and confirm that tower now sits inside the free part of the screen, near its centre
  for (const iso of ["SG", "NG", "GB"]) {
    await setView(iso, 30, "view.maxDist", 0.3);   // start zoomed out with the tower off-centre, as a visitor would find it
    let pt = await centreOf(iso);
    if (!pt) { await setView(iso, 30, "view.maxDist", 0.12); pt = await centreOf(iso); }   // a small tower near the limb can fall outside the testable area: slide it less
    if (!pt) { console.log(`  (landing check: ${iso} not visible to start from)`); continue; }
    if (!await check(`landing/${iso} tap`, iso, pt[0], pt[1])) continue;
    await settled();
    const r = await page.evaluate(iso => {
      const t = towers.find(t => t.ref.iso === iso && !t.isCity), v = new THREE.Vector3().copy(t.pos).applyQuaternion(world.quaternion), n = new THREE.Vector3().copy(t.normal).applyQuaternion(world.quaternion);
      const p = toScreen(v.clone().addScaledVector(n, Math.min(t.v, t.n) * t.dims.h * 0.5));
      const pr = document.querySelector("#panel").getBoundingClientRect(), narrow = isNarrow();
      const x0 = 0, x1 = narrow ? innerWidth : pr.left, y0 = 0, y1 = narrow ? pr.top : innerHeight;   // the free area: beside the panel, or above the open sheet
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, dx = Math.abs(p.x - cx) / (x1 - x0), dy = Math.abs(p.y - cy) / (y1 - y0);
      return { x: Math.round(p.x), y: Math.round(p.y), inside: p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1, offCentre: Math.max(dx, dy), free: [Math.round(x1), Math.round(y1)], selected: state.selected && state.selected.iso };
    }, iso);
    total++;
    if (r.selected !== iso || !r.inside || r.offCentre > 0.2) { fail++; failures.push(`  ✗ landing/${iso}: after the fly the tower is at (${r.x},${r.y}), free area ${r.free[0]}x${r.free[1]}, inside=${r.inside}, ${Math.round(r.offCentre*100)}% off centre, selected=${r.selected}`); }
    else console.log(`landing ${iso}: ok (tower at (${r.x},${r.y}) in a ${r.free[0]}x${r.free[1]} free area, ${Math.round(r.offCentre*100)}% off centre)`);
  }

  // 3. idle auto-rotation: no selection, no input for >3 s, then tap a tower where it is at that instant
  {
    await setView("NG", 6, "view.maxDist"); await page.evaluate(() => { view.lastInteract = -1e9; view.tPanX = view.tPanY = view.panX = view.panY = 0; }); await sleep(3600);
    const rot = await page.evaluate(() => ({ yaw: view.yaw }));
    const pick = await page.evaluate(() => { for (const iso of ["NG", "ZA", "DE", "SA", "IN"]) { const t = towers.find(t => t.ref.iso === iso && !t.isCity); if (t && t.v >= 0.5) return iso; } return null; });
    const pt = pick ? await centreOf(pick) : null;
    if (pt) { const ok = await check("auto-rotating", pick, pt[0], pt[1]); const after = await page.evaluate(() => view.yaw); console.log(`auto-rotating tap: ${ok ? "ok" : "FAILED"} (${pick}; globe turned ${((after - rot.yaw)/deg).toFixed(2)}° during the test)`); }
  }

  // 4. mid-flight: start a fly from the US to Japan, and 350 ms in tap whatever tower is under a point computed that same instant
  {
    await setView("US", 30, "view.maxDist");
    await page.evaluate(() => { const jp = DATA.countries.find(c => c.iso === "JP"); flyTo(jp, lerp(view.minDist, view.maxDist, 0.5), 0.2); }); await sleep(350);
    const under = await page.evaluate(() => {   // choose a point known to be on a tower right now, from the production cast itself at the frame before the tap
      const pr = document.querySelector("#panel").getBoundingClientRect(), narrow = isNarrow(), bottom = narrow ? pr.top - 10 : innerHeight - 70, right = narrow ? innerWidth - 10 : pr.left - 10;
      for (const t of towers) { if (t.v < 0.5 || t.isCity || t.ref.isContinent) continue;
        const v = new THREE.Vector3().copy(t.pos).applyQuaternion(world.quaternion), n = new THREE.Vector3().copy(t.normal).applyQuaternion(world.quaternion);
        if (n.dot(camera.position.clone().sub(v)) <= 0.05) continue;
        const p = toScreen(v.clone().addScaledVector(n, Math.min(t.v, t.n) * t.dims.h * 0.5)); if (p.x < 60 || p.x > right || p.y < 120 || p.y > bottom) continue;
        const h = castAt(p.x, p.y); if (h && h.type === "tower" && h.t === t) return { iso: t.ref.iso, x: Math.round(p.x), y: Math.round(p.y) }; }
      return null; });
    if (under) { total++; await tap(under.x, under.y); await frames();
      const got = await page.evaluate(() => state.selected ? state.selected.iso : state.selectedDC ? "dc:" + state.selectedDC.name : null), at = await lastTap();
      // mid-flight the globe moves between the point computation and the tap; what matters is that the selection equals what the
      // hit-test saw at the instant of the tap, and that the hit-test agreed with a fresh-matrix raycast at that same instant
      if (!at) { fail++; failures.push("  ✗ mid-flight: the tap never reached the hit-test"); }
      else if (at.prod !== at.fresh) { fail++; failures.push(`  ✗ mid-flight: stale-matrix check: hit-test said ${at.prod}, fresh raycast said ${at.fresh}`); }
      else if ((got || null) !== (at.prod || null)) { fail++; failures.push(`  ✗ mid-flight: hit-test saw ${at.prod} but ${got} was selected`); }
      else console.log(`mid-flight tap: ok (aimed at ${under.iso}; at the instant of the tap the globe had moved so ${at.prod || "nothing"} was under the finger, and ${got || "nothing"} was selected)`); }
  }

  console.log(`\n${total - fail}/${total} picks correct on ${W}x${H} @${DPR}x ${touch ? "touch" : "mouse"}`);
  failures.forEach(f => console.log(f));
  if (errors.length) console.log("page errors:", errors);
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
