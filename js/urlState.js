/* URL state: ?country={iso}, ?tab={usage|spend|access|key}, ?layer={power|data|dataShare}. Read once on load
   (js/main.js), written on change with history.replaceState so the address bar is always a deep link. Other
   parameters (intro, panel, quality …) are left as they are; defaults are removed rather than written. */
const DEFAULTS = { country: null, tab: "usage", layer: "none" };
export function readUrlState(){
  const p = new URLSearchParams(location.search);
  return { country: (p.get("country") || "").toUpperCase() || null, tab: p.get("tab"), layer: p.get("layer") };
}
export function writeUrlState(patch){
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(patch)){ if (v == null || v === DEFAULTS[k]) p.delete(k); else p.set(k, v); }
  const q = p.toString(), url = location.pathname + (q ? "?" + q : "") + location.hash;
  if (url !== location.pathname + location.search + location.hash) history.replaceState(history.state, "", url);
}
