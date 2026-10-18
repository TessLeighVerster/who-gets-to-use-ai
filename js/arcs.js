/* Arcs from a selected country to the data centres that serve it (or from a data centre to the countries it serves):
   solid flexible plastic tubes, not light. Each arc is a Line2 (screen-space width in pixels, worldUnits:false) in the
   operator's colour over a slightly wider, darker outline Line2, plus a small plastic disc at each end (spare instances
   of the contact-disc mesh, tinted). A slow dashed seam travels along the tube (dashOffset uniform, one write per frame);
   it is frozen for prefers-reduced-motion and on the low quality tier. Arcs draw in over ~400 ms (instanceCount) and
   fade out over ~180 ms (opacity). Curve maths: js/arcMath.js. */
import { Line2, LineGeometry, LineMaterial } from "./vendor/three-fatlines.js";
import { arcPoints, ARC_POINTS } from "./arcMath.js";
import { easeOutCubic } from "./util.js";

const DRAW_MS = 400, FADE_MS = 180, DASH_SPEED = 0.55;   // dash units per second (in the material's dash scale)
const TUBE_OPACITY = 0.82, OUTLINE_OPACITY = 0.5, SEAM_OPACITY = 0.16;   // subtle: the arcs support the towers, they do not compete with them
const OUTLINE_PX = 1.4;                                   // outline is this much wider than the tube on each side
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createArcs({ world, contact, contactBase, contactSpare, isPhone, lowTier, project }){
  // project(vec3 in world-local) → { x, y, visible } in page pixels; labels follow the arc ends
  const labelBox = document.getElementById("arcLabels");
  const group = new THREE.Group(); world.add(group);
  const res = new THREE.Vector2(1, 1);
  const arcs = [];                 // live arcs: { line, outline, mat, omat, key, width, cap:[i,j], from, to, t0, dying, baseOpacity }
  const dying = [];
  let hovered = null, pointerFine = window.matchMedia("(pointer:fine)").matches;
  const basePx = () => (isPhone() ? 3 : 2);
  const _M = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _n = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);
  let spareCursor = 0; const spare = () => { const i = contactBase + (spareCursor++ % contactSpare); return i; };
  const setCap = (i, pos, hex, r) => { _n.copy(pos).normalize(); _q.setFromUnitVectors(_up, _n); _p.copy(_n).multiplyScalar(pos.length()*1.0005); _s.setScalar(r); _M.compose(_p, _q, _s); contact.setMatrixAt(i, _M); contact.setColorAt(i, _c.setHex(hex)); };
  const clearCap = i => { _s.setScalar(0); _M.compose(_p.set(0, 0, 0), _q.identity(), _s); contact.setMatrixAt(i, _M); };
  /* pairs: [{from:Vector3, to:Vector3, color:hex, key:string}] in world-local coordinates; nearest first keeps full width,
     farther ones step down slightly when there are more than three, but every arc is drawn */
  let caption = null;
  function show(pairs, captionText){
    clear(true);
    if (labelBox && captionText){ caption = document.createElement("div"); caption.className = "arclabel caption"; caption.textContent = captionText; labelBox.appendChild(caption); }
    const sorted = pairs.slice(0, 16).map(p => ({ ...p, len: p.from.angleTo(p.to) })).sort((a, b) => a.len - b.len);
    const now = performance.now(), base = basePx();
    sorted.forEach((pr, i) => {
      const width = sorted.length > 3 ? Math.max(base*0.6, base - i*0.3) : base;
      const pts = arcPoints([pr.from.x, pr.from.y, pr.from.z], [pr.to.x, pr.to.y, pr.to.z], 1, ARC_POINTS);
      const geo = new LineGeometry(); geo.setPositions(pts);
      const ogeo = new LineGeometry(); ogeo.setPositions(pts);
      // solid tube
      const mat = new LineMaterial({ color: pr.color, linewidth: width, worldUnits: false, transparent: true, opacity: TUBE_OPACITY, depthWrite: true }); mat.resolution.copy(res);
      const line = new Line2(geo, mat); line.computeLineDistances(); line.renderOrder = 3;
      // darker outline, a little wider, drawn first so the tube sits on it
      const omat = new LineMaterial({ color: 0x000000, linewidth: width + OUTLINE_PX*2, worldUnits: false, transparent: true, opacity: OUTLINE_OPACITY, depthWrite: false }); omat.resolution.copy(res);
      const outline = new Line2(ogeo, omat); outline.computeLineDistances(); outline.renderOrder = 2;
      // moving seam: a dashed, slightly darker copy on top (dash offset animated), skipped on the low tier
      let seam = null, smat = null;
      if (!lowTier()){ smat = new LineMaterial({ color: 0x000000, linewidth: Math.max(1, width*0.35), worldUnits: false, transparent: true, opacity: SEAM_OPACITY, depthWrite: false, dashed: true, dashScale: 10, dashSize: 0.9, gapSize: 1.6 }); smat.resolution.copy(res); smat.defines.USE_DASH = ""; seam = new Line2(geo, smat); seam.computeLineDistances(); seam.renderOrder = 4; }
      const n = ARC_POINTS - 1; geo.instanceCount = 0; ogeo.instanceCount = 0;
      group.add(outline, line); if (seam) group.add(seam);
      const caps = [spare(), spare()];
      setCap(caps[0], pr.from, pr.color, 0.009); setCap(caps[1], pr.to, pr.color, 0.009);
      let label = null;
      if (labelBox && pr.label){ label = document.createElement("div"); label.className = "arclabel"; label.innerHTML = `<i style="background:#${pr.color.toString(16).padStart(6, "0")}"></i>${pr.label}`; labelBox.appendChild(label); }
      arcs.push({ line, outline, seam, mat, omat, smat, geo, ogeo, key: pr.key || "", width, caps, t0: now, n, dc: pr.dc || null, oOpacity: OUTLINE_OPACITY, baseOpacity: 1, label, from: pr.from.clone(), to: pr.to.clone() });
    });
    contact.instanceMatrix.needsUpdate = true; if (contact.instanceColor) contact.instanceColor.needsUpdate = true;
  }
  function clear(soft){
    for (const a of arcs){ a.dying = performance.now(); dying.push(a); a.caps.forEach(clearCap); if (a.label){ a.label.remove(); a.label = null; } }
    if (caption){ caption.remove(); caption = null; }
    arcs.length = 0; hovered = null;
    contact.instanceMatrix.needsUpdate = true;
    if (!soft) reap(true);
  }
  function dispose(a){ group.remove(a.line, a.outline); if (a.seam) group.remove(a.seam); a.geo.dispose(); a.ogeo.dispose(); a.mat.dispose(); a.omat.dispose(); if (a.smat) a.smat.dispose(); }
  function reap(all){ const now = performance.now(); for (let i = dying.length - 1; i >= 0; i--){ const a = dying[i]; if (all || now - a.dying > FADE_MS){ dispose(a); dying.splice(i, 1); } } }
  /* hovering a data-centre brick while a country is selected: its arc thickens, the others dim to 50% (fine pointers only) */
  function highlight(dc){
    if (!pointerFine) return; if (hovered === dc) return; hovered = dc || null;
    for (const a of arcs){ const on = hovered && a.dc === hovered; const dim = hovered && !on; a.mat.linewidth = a.width*(on ? 1.35 : 1); a.omat.linewidth = a.mat.linewidth + OUTLINE_PX*2; a.oOpacity = on ? 0.9 : OUTLINE_OPACITY; a.baseOpacity = dim ? 0.5 : 1; if (a.label) a.label.classList.toggle("dim", !!dim); }
  }
  function step(now){
    const t = now/1000, frozen = reduceMotion || lowTier();
    for (const a of arcs){
      const k = Math.min(1, (now - a.t0)/DRAW_MS), cnt = Math.max(1, Math.round(easeOutCubic(k)*a.n));
      a.geo.instanceCount = cnt; a.ogeo.instanceCount = cnt;
      const op = a.baseOpacity; a.mat.opacity = TUBE_OPACITY*op; a.omat.opacity = a.oOpacity*op; if (a.smat){ a.smat.opacity = SEAM_OPACITY*op; if (!frozen) a.smat.dashOffset = -t*DASH_SPEED; }
      if (a.label && project){ const s = project(a.to); const shown = k >= 1 && s.visible; a.label.style.opacity = shown ? 1 : 0; if (shown) a.label.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, 10px)`; }
    }
    if (caption && arcs.length && project){ const s = project(arcs[0].from); const shown = s.visible; caption.style.opacity = shown ? 1 : 0; if (shown) caption.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, 18px)`; }
    for (const a of dying){ const f = Math.max(0, 1 - (now - a.dying)/FADE_MS); a.mat.opacity = TUBE_OPACITY*f; a.omat.opacity = a.oOpacity*f; if (a.smat) a.smat.opacity = SEAM_OPACITY*f; }
    reap(false);
  }
  function setResolution(w, h){ res.set(w, h); for (const a of arcs.concat(dying)){ a.mat.resolution.copy(res); a.omat.resolution.copy(res); if (a.smat) a.smat.resolution.copy(res); } }
  return { show, clear, step, highlight, setResolution, group, get count(){ return arcs.length; } };
}
