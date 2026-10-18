#!/usr/bin/env node
// Unit tests for js/arcMath.js: a short hop, a trans-continental arc and an antipodal pair.   node tools/arcs.test.mjs
import assert from "node:assert/strict";
import { arcPoints, arcLift, ARC_POINTS, LIFT_MIN, LIFT_MAX } from "../js/arcMath.js";
const ll = (lat, lon) => { const la = lat*Math.PI/180, lo = lon*Math.PI/180, c = Math.cos(la); return [c*Math.sin(lo), Math.sin(la), c*Math.cos(lo)]; };
const pts = a => Array.from({ length: a.length/3 }, (_, i) => [a[i*3], a[i*3+1], a[i*3+2]]);
const len = p => Math.hypot(...p);
const angle = (p, q) => Math.acos(Math.max(-1, Math.min(1, (p[0]*q[0]+p[1]*q[1]+p[2]*q[2])/(len(p)*len(q)))));
function check(name, from, to){
  const P = pts(arcPoints(from, to, 1, ARC_POINTS)), ang = angle(from, to);
  assert.equal(P.length, ARC_POINTS, name + ": point count");
  assert.ok(angle(P[0], from) < 1e-6 && Math.abs(len(P[0]) - 1.004) < 1e-6, name + ": starts at the surface above `from`");
  assert.ok(angle(P.at(-1), to) < 1e-6 && Math.abs(len(P.at(-1)) - 1.004) < 1e-6, name + ": ends at the surface above `to`");
  const apex = Math.max(...P.map(len)) - 1.004;
  assert.ok(Math.abs(apex - arcLift(ang)) < 0.003, `${name}: apex ${apex.toFixed(4)} ≈ lift ${arcLift(ang).toFixed(4)}`);
  for (const p of P) assert.ok(len(p) >= 1.004 - 1e-6, name + ": never dips below the surface");
  let walked = 0; for (let i = 1; i < P.length; i++){ walked += angle(P[i-1], P[i]); assert.ok(angle(P[i-1], P[i]) < ang/(ARC_POINTS-1)*1.5 + 1e-9, name + ": evenly spaced"); }
  assert.ok(Math.abs(walked - ang) < 1e-6, `${name}: follows the great circle (${walked.toFixed(4)} vs ${ang.toFixed(4)} rad)`);
  return { ang, apex };
}
const short = check("short hop (Cape Town → Johannesburg)", ll(-33.9, 18.4), ll(-26.2, 28.0));
{ const chord = 2*Math.sin(short.ang/2); assert.ok(short.apex < 0.3*chord, `short hop stays low: apex ${short.apex.toFixed(3)} vs chord ${chord.toFixed(3)}`); }
const trans = check("trans-continental (Lagos → Ashburn)", ll(6.5, 3.4), ll(39.0, -77.5));
assert.ok(trans.apex > short.apex && trans.apex <= LIFT_MAX + 1e-9, "longer arc lifts more, within the cap");
const anti = check("antipodal (Madrid → Wellington)", ll(40.4, -3.7), ll(-40.4, 176.3));
assert.ok(Math.abs(anti.apex - LIFT_MAX) < 0.003, "antipodal arc is capped at LIFT_MAX");
const exact = pts(arcPoints([0, 0, 1], [0, 0, -1])); assert.equal(exact.length, ARC_POINTS); assert.ok(exact.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])), "exact antipodes: finite points"); assert.ok(exact[Math.floor(ARC_POINTS/2)][1] > 0.9, "exact antipodes: goes over the pole");
console.log(`arcMath: ok · short hop apex ${short.apex.toFixed(3)} (${(short.ang*180/Math.PI).toFixed(1)}°), trans-continental ${trans.apex.toFixed(3)} (${(trans.ang*180/Math.PI).toFixed(0)}°), antipodal ${anti.apex.toFixed(3)} (${(anti.ang*180/Math.PI).toFixed(0)}°)`);
