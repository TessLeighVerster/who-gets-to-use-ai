/* The curve of an arc between two points on the globe, as plain numbers so it can be unit-tested without Three.js
   (tools/arcs.test.mjs). Great-circle interpolation (slerp) between the two surface points, lifted by a sine bump
   whose apex height grows with the angular distance and is capped so short hops stay low and antipodes do not loop. */
export const ARC_POINTS = 48;        // points per arc, the maximum the brief allows
export const LIFT_MIN = 0.02;        // apex height above the surface for the shortest hops (globe radius = 1)
export const LIFT_MAX = 0.22;        // apex cap for trans-continental and antipodal arcs
export const LIFT_PER_RADIAN = 0.16; // how fast the apex rises with angular distance

const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/* apex height for an angular distance (radians) */
export function arcLift(angle){ return Math.min(LIFT_MAX, LIFT_MIN + LIFT_PER_RADIAN*angle); }

/* from, to: [x,y,z] on or near the sphere; radius: sphere radius; returns a flat Float32Array of n points (x,y,z…) */
export function arcPoints(from, to, radius = 1, n = ARC_POINTS){
  const a = norm(from), b = norm(to);
  let ang = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  // antipodal (or nearly): pick a consistent great circle through the north pole so the arc is well defined
  let axis = cross(a, b);
  if (Math.hypot(axis[0], axis[1], axis[2]) < 1e-6){ axis = cross(a, [0, 1, 0]); if (Math.hypot(axis[0], axis[1], axis[2]) < 1e-6) axis = cross(a, [1, 0, 0]); axis = norm(axis); if (ang < 1e-6 && dot(a, b) < 0) ang = Math.PI; }
  else axis = norm(axis);
  const lift = arcLift(ang), out = new Float32Array(n*3), sinA = Math.sin(ang);
  for (let i = 0; i < n; i++){
    const f = i/(n-1); let p;
    if (sinA < 1e-6){   // degenerate: rotate `a` about the chosen axis by f·ang (Rodrigues)
      const c = Math.cos(f*ang), s = Math.sin(f*ang), k = axis, d = dot(k, a);
      p = [a[0]*c + (k[1]*a[2]-k[2]*a[1])*s + k[0]*d*(1-c), a[1]*c + (k[2]*a[0]-k[0]*a[2])*s + k[1]*d*(1-c), a[2]*c + (k[0]*a[1]-k[1]*a[0])*s + k[2]*d*(1-c)];
    } else { const sa = Math.sin((1-f)*ang)/sinA, sb = Math.sin(f*ang)/sinA; p = norm([a[0]*sa+b[0]*sb, a[1]*sa+b[1]*sb, a[2]*sa+b[2]*sb]); }
    const r = radius*(1.004 + lift*Math.sin(f*Math.PI));
    out[i*3] = p[0]*r; out[i*3+1] = p[1]*r; out[i*3+2] = p[2]*r;
  }
  return out;
}
