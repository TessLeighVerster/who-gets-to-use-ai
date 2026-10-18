/* Bootstrap. Order matters for a slow phone: the intro is wired first (it needs only the data and js/geo.js), then
   Three.js is loaded from cdnjs as a global, then scene.js and panel.js are imported (building the globe and filling
   the panel as a side effect) and the frame loop starts. Until the first frame has rendered, #placeholder shows a
   static dot-grid globe behind the intro. */
import { $, clamp, lerp, deg } from "./util.js";
import { state, view } from "./state.js";
import { DATA } from "./model.js";
import { intro, threeReady } from "./intro.js";
import { readUrlState } from "./urlState.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* The claim the intro leads with. Country names become links that open that country's card. The numbers are read from
   the data (subscriptionShareOfIncome: a US$20/month plan as a share of GDP per capita per month, see data/countries.js). */
export const HERO_STAT = {
  a: "NO", b: "CD",
  text: (a, b) => `A $20 AI subscription costs <b>${a.subscriptionShareOfIncome}%</b> of monthly income per person in ${link(a)} and <b>${b.subscriptionShareOfIncome}%</b> in ${link(b)}.`
};
const link = c => `<a href="?country=${c.iso}" data-iso="${c.iso}">${c.name}</a>`;

/* =====================================================================================
   INTRO: wired by js/intro.js before this module runs; here the hero sentence is re-rendered from the data and the
   queued action (open a country, focus search) is carried out once the scene is ready.
   ===================================================================================== */
{
  const A = DATA.countries.find(c => c.iso === HERO_STAT.a), B = DATA.countries.find(c => c.iso === HERO_STAT.b);
  const hero = $("#heroStat"); if (hero){ const src = $("#heroSrc"); hero.innerHTML = HERO_STAT.text(A, B) + (src ? " " + src.outerHTML : ""); }
}
let app = null;              // { select, showTab, searchEl, syncSheet, isNarrow } once scene.js/panel.js are loaded
function runPending(){
  if (!app || !intro.pending) return;
  const p = intro.take();
  if (p.select){ const c = DATA.countries.find(x => x.iso === p.select); if (c){ app.showTab("usage"); app.select(c); } }
  else if (p.search){ if (app.isNarrow()){ $("#panel").classList.remove("strip"); app.syncSheet(); } app.searchEl.focus(); }
}
intro.onAction(runPending);

/* =====================================================================================
   LOAD THREE.JS (global from cdnjs), THEN THE SCENE AND THE PANEL
   ===================================================================================== */
await threeReady;   // started by js/intro.js as soon as the overlay was wired
const [S, P] = await Promise.all([import("./scene.js"), import("./panel.js")]);
const { renderer, scene, camera, towers, targetBricks, animateTower, stepTowers, stepFocus, eggs, applyView, stepHover, ring, stepArcs, updateCompass, resize, isNarrow } = S;
const { select, showTab, syncSheet, searchEl, tickCounters } = P;
app = { select, showTab, searchEl, syncSheet, isNarrow };
if (new URLSearchParams(location.search).has("debug")) window.__exhibit = { scene: S, panel: P, state, view, DATA };   // test hook for tools/ (perf profile, view screenshots)
/* deep links: ?layer= and ?tab= apply as soon as the scene is ready; ?country= opens that card (and skipped the intro) */
function applyUrlState(){
  const u = readUrlState();
  if (u.layer && u.layer !== "none") S.setLayer(u.layer, true);
  if (u.tab && ["usage", "spend", "access", "key"].includes(u.tab)) showTab(u.tab);
  const c = u.country && DATA.countries.find(x => x.iso === u.country);
  if (c && !intro.pending) select(c);
}

/* =====================================================================================
   FRAME LOOP
   ===================================================================================== */
let last = performance.now(), ready = false, fpsN = 0, fpsAcc = 0;
const FLY_EASE = 2.6;
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  // quality tier: if the first 60 frames average under 50 fps, drop to the low tier (unless ?quality= forced one)
  if (fpsN < 60){ fpsAcc += (now - (frame.prev || now)); frame.prev = now; if (++fpsN === 60 && fpsAcc/59 > 1000/50 && S.quality.tier === "high" && !S.quality.forced) S.setQuality("low"); }
  // build-up on first frames
  if (!state.built){ state.built = true; towers.forEach((t,i) => { const tgt = targetBricks(t); if (tgt>0) animateTower(t, tgt, 1700, 250 + (i%17)*45 + (i*7%5)*30, now); }); setTimeout(()=>$("#hint").classList.add("show"), 2600); }
  stepTowers(now); stepFocus(dt); eggs.step(now, dt);
  // orbit: inertia, auto-rotate after 3 s idle (not when the visitor prefers reduced motion), smoothing
  const hasSel = !!(state.selected || state.selectedDC);
  if (hasSel && now - view.lastInteract > 90000) select(null);
  const idle = !hasSel && now - view.lastInteract > 3000;
  if (!S.dragging){
    if (Math.abs(view.yawVel) > 1e-5 || Math.abs(view.pitchVel) > 1e-5){
      view.tYaw += view.yawVel; view.tPitch = clamp(view.tPitch + view.pitchVel, -80*deg, 80*deg);
      const damp = Math.pow(0.92, dt*60); view.yawVel *= damp; view.pitchVel *= damp;
      if (Math.abs(view.yawVel) < 1e-5) view.yawVel = 0; if (Math.abs(view.pitchVel) < 1e-5) view.pitchVel = 0;
    } else if (idle && !view.flying && !reduceMotion){ view.tYaw += 0.06*dt; }
  }
  const k = view.flying ? 1-Math.pow(0.001, dt) : 1-Math.pow(0.0005, dt);
  view.yaw = lerp(view.yaw, view.tYaw, view.flying ? Math.min(1, dt*FLY_EASE) : k);   // fly-to: a touch slower and more decelerated, reaching for a model rather than a drone cut
  view.pitch = lerp(view.pitch, view.tPitch, view.flying ? Math.min(1, dt*FLY_EASE) : k);
  view.dist = lerp(view.dist, view.tDist, Math.min(1, dt*4));
  view.panX = lerp(view.panX, view.tPanX, Math.min(1, dt*6)); view.panY = lerp(view.panY, view.tPanY, Math.min(1, dt*6));
  if (view.flying && Math.abs(view.yaw-view.tYaw) < 0.002 && Math.abs(view.pitch-view.tPitch) < 0.002) view.flying = false;
  if (!view.flying && idle){ view.yaw = view.tYaw; } // no lag while auto-rotating
  applyView();
  // hover is re-tested every frame (not just on mouse move) so it stays accurate while the globe turns or flies
  stepHover(now);
  // ring pulse, halos, counters
  if (ring.visible){ const p = (now - ring.userData.t0)/1000; const s = ring.userData.base; const pulse = s*(1+0.12*Math.sin(p*3)); ring.scale.set(pulse, pulse, pulse); ring.material.opacity = 0.65+0.3*Math.sin(p*3); }
  stepArcs(now);
  tickCounters(now); updateCompass();
  renderer.render(scene, camera);
  if (!ready){ ready = true; document.body.classList.add("ready"); setTimeout(() => { const ph = $("#placeholder"); if (ph) ph.remove(); }, 700); intro.startTimer(); applyUrlState(); runPending(); }   // the real scene is on screen: drop the placeholder, run what the intro queued
}

/* init */
window.addEventListener("resize", () => { resize(); syncSheet(); });
if (isNarrow()) $("#panel").classList.add("strip");
resize(); syncSheet(); applyView();
requestAnimationFrame(frame);
