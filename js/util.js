/* Small helpers shared by every module: DOM lookup, maths, easing, number formatting, lat/lon → vector. */
export const $ = s => document.querySelector(s);
export const clamp = (v,a,b) => v<a?a:v>b?b:v;
export const lerp = (a,b,t) => a+(b-a)*t;
export const easeOutCubic = t => 1-Math.pow(1-t,3);
export const easeInOutCubic = t => t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
export const easeOutBack = t => { const c1=1.70158, c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); };
export const fmtInt = n => Math.floor(n).toLocaleString("en-US");
export const fmtMoney = n => n>=1e9 ? "$"+(n/1e9).toFixed(2)+" B" : n>=1e6 ? "$"+(n/1e6).toFixed(2)+" M" : "$"+fmtInt(n);
export const fmtM = n => n>=100 ? fmtInt(n)+" M" : n>=10 ? n.toFixed(0)+" M" : n>=1 ? n.toFixed(1)+" M" : Math.round(n*1000)+" k";
export const deg = Math.PI/180;
export function latLonToVec(lat, lon, r, out){
  const la = lat*deg, lo = lon*deg, c = Math.cos(la);
  out.set(c*Math.sin(lo)*r, Math.sin(la)*r, c*Math.cos(lo)*r); return out;
}
export const hexCss = h => "#"+h.toString(16).padStart(6,"0");
