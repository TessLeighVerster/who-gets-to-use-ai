/* Bootstrap: the frame loop, the intro overlay and the initial resize. Importing scene.js and panel.js builds the
   globe and fills the panel as a side effect. */
import { $, clamp, lerp, deg } from "./util.js";
import { state, view } from "./state.js";
import { renderer, scene, camera, towers, targetBricks, animateTower, stepTowers, stepFocus, eggs, dragging, applyView, stepHover, ring, dcMesh, stepArcs, focus, updateCompass, resize, isNarrow } from "./scene.js";
import { select, syncSheet, searchEl, runSearch, tickCounters } from "./panel.js";

/* =====================================================================================
   FRAME LOOP
   ===================================================================================== */
let last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  // build-up on first frames
  if (!state.built){ state.built = true; towers.forEach((t,i) => { const tgt = targetBricks(t); if (tgt>0) animateTower(t, tgt, 1700, 250 + (i%17)*45 + (i*7%5)*30, now); }); setTimeout(()=>$("#hint").classList.add("show"), 2600); }
  stepTowers(now); stepFocus(dt); eggs.step(now, dt);
  // orbit: inertia, auto-rotate after 3 s idle, smoothing
  const hasSel = !!(state.selected || state.selectedDC);
  if (hasSel && now - view.lastInteract > 90000) select(null);
  const idle = !hasSel && now - view.lastInteract > 3000;
  if (!dragging){
    if (Math.abs(view.yawVel) > 1e-5 || Math.abs(view.pitchVel) > 1e-5){
      view.tYaw += view.yawVel; view.tPitch = clamp(view.tPitch + view.pitchVel, -80*deg, 80*deg);
      const damp = Math.pow(0.92, dt*60); view.yawVel *= damp; view.pitchVel *= damp;
      if (Math.abs(view.yawVel) < 1e-5) view.yawVel = 0; if (Math.abs(view.pitchVel) < 1e-5) view.pitchVel = 0;
    } else if (idle && !view.flying){ view.tYaw += 0.06*dt; }
  }
  const k = view.flying ? 1-Math.pow(0.001, dt) : 1-Math.pow(0.0005, dt);
  view.yaw = lerp(view.yaw, view.tYaw, view.flying ? Math.min(1, dt*3.2) : k);
  view.pitch = lerp(view.pitch, view.tPitch, view.flying ? Math.min(1, dt*3.2) : k);
  view.dist = lerp(view.dist, view.tDist, Math.min(1, dt*4));
  view.panX = lerp(view.panX, view.tPanX, Math.min(1, dt*6)); view.panY = lerp(view.panY, view.tPanY, Math.min(1, dt*6));
  if (view.flying && Math.abs(view.yaw-view.tYaw) < 0.002 && Math.abs(view.pitch-view.tPitch) < 0.002) view.flying = false;
  if (!view.flying && idle){ view.yaw = view.tYaw; } // no lag while auto-rotating
  applyView();
  // hover
  // hover is re-tested every frame (not just on mouse move) so it stays accurate while the globe turns or flies
  stepHover(now);
  // ring pulse, halos, counters
  if (ring.visible){ const p = (now - ring.userData.t0)/1000; const s = ring.userData.base; const pulse = s*(1+0.12*Math.sin(p*3)); ring.scale.set(pulse, pulse, pulse); ring.material.opacity = 0.65+0.3*Math.sin(p*3); }
  dcMesh.userData.halo.material.uniforms.t.value = now/1000;
  stepArcs(now);
  { const b = (0.8 + 0.35*Math.sin(now/1000*2.2))*(focus.dcMul||1); dcMesh.material.color.setRGB(b,b,b); }
  tickCounters(now); updateCompass();
  renderer.render(scene, camera);
}

/* intro: short welcome on load; any click, key or the timer dismisses it */
{
  const el = $("#intro"); let done = false;
  document.body.classList.add("intro");
  const dismiss = q => { if (done) return; done = true; el.classList.add("out"); document.body.classList.remove("intro"); setTimeout(() => el.remove(), 450);
    if (q){ searchEl.value = q; runSearch(); if (isNarrow()){ $("#panel").classList.remove("strip"); syncSheet(); } searchEl.focus(); } };
  $("#introGo").addEventListener("click", () => dismiss());
  el.querySelectorAll("[data-q]").forEach(b => b.addEventListener("click", () => dismiss(b.dataset.q)));
  el.addEventListener("click", e => { if (e.target === el) dismiss(); });
  window.addEventListener("keydown", () => dismiss(), {once:true});
  setTimeout(() => dismiss(), 9400);
  if (location.search.includes("nointro")) dismiss();
}

/* init */
window.addEventListener("resize", () => { resize(); syncSheet(); });
if (isNarrow()) $("#panel").classList.add("strip");
resize(); syncSheet(); applyView();
requestAnimationFrame(frame);
