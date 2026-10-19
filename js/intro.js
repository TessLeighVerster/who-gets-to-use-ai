/* The intro overlay, wired as early as possible: this module depends only on js/geo.js and data/countryNames.js
   (a few KB), so the overlay is usable long before Three.js, the scene and the full data arrive. Anything that needs
   the scene (opening a country card, focusing search) is queued as `intro.pending` and run by js/main.js once the
   first frame has rendered. The hero sentence itself is static HTML; main.js re-renders it from the data (HERO_STAT).

   The overlay does not close by itself. URL switches: ?intro=0 or ?nointro skips the intro, ?intro=1 forces it even if it was seen this session.
   Storage: one sessionStorage flag, "introSeen". No cookies, no network. */
import { detectCountry } from "./geo.js";
import { COUNTRY_NAMES } from "../data/countryNames.js";

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const el = $("#intro"), go = $("#introGo");
let done = false, pending = null;
const listeners = [];
export const intro = {
  get pending(){ return pending; },
  take(){ const p = pending; pending = null; return p; },        // main.js takes the queued action once it can act on it
  onAction(fn){ listeners.push(fn); },                           // or subscribes, for actions after the scene is ready
  dismiss, startTimer, countryIso: null
};
function dismiss(action){
  if (done){ if (action) emit(action); return; }
  done = true;
  try { sessionStorage.setItem("introSeen", "1"); } catch (_) {}
  el.classList.add("out"); document.body.classList.remove("intro"); setTimeout(() => el.remove(), 450);
  if (action) emit(action);
}
function emit(action){ pending = action; listeners.forEach(fn => fn()); }
function startTimer(){}
/* the illustration's middle tower carries the visitor's country name (Norway and DR Congo already have their own towers) */
function labelMiddleTower(iso){
  if (iso === "NO" || iso === "CD") return;
  const t = $("#introArtMid"), bg = $("#introArtMidBg"); if (!t || !bg) return;
  t.textContent = COUNTRY_NAMES[iso].toUpperCase();
  try { const b = t.getBBox(); bg.setAttribute("x", (b.x - 11).toFixed(1)); bg.setAttribute("width", (b.width + 22).toFixed(1)); } catch (_) {}
}   // no auto-dismiss: the overlay stays until the visitor picks a country, explores, or presses Escape

const seen = (() => { try { return sessionStorage.getItem("introSeen") === "1"; } catch (_) { return false; } })();
const skip = params.get("intro") === "0" || params.has("nointro") || params.has("country") || (params.get("intro") !== "1" && seen);   // a deep link goes straight to its country

// beat 1: country names in the claim open that country; the source marker opens the methodology panel (?panel=methodology)
$("#heroStat").addEventListener("click", e => {
  const a = e.target.closest("a"); if (!a) return;
  e.preventDefault();
  if (a.dataset.iso) dismiss({ select: a.dataset.iso });
  else if (a.id === "heroSrc"){ history.replaceState(null, "", "?panel=methodology"); window.dispatchEvent(new CustomEvent("open-panel", { detail: "methodology" })); dismiss(); }   // TODO(methodology panel): listen for this event and open it
});
// beat 3: the call to action names the visitor's own country when the time zone or browser language gives one away
const iso = detectCountry(new Set(Object.keys(COUNTRY_NAMES)));
intro.countryIso = iso;
if (iso){ go.textContent = `See ${COUNTRY_NAMES[iso]} →`; go.addEventListener("click", () => dismiss({ select: iso })); labelMiddleTower(iso); }
else { go.textContent = "See where you stand →"; go.addEventListener("click", () => dismiss({ search: true })); }
$("#introExplore").addEventListener("click", () => dismiss());
el.addEventListener("click", e => { if (e.target === el) dismiss(); });
window.addEventListener("keydown", e => { if (e.key === "Escape") dismiss(); });
go.dataset.ready = "1"; performance.mark("intro-wired");   // tools/intro-perf.mjs reads the mark: the overlay is interactive from here on
if (skip) dismiss();

/* Only now start downloading Three.js (a 600 KB global from cdnjs): on a slow connection a preload would compete with
   the few KB this module needs, and the overlay must be usable first. js/main.js awaits threeReady. */
export const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js";
export const threeReady = new Promise((resolve, reject) => {
  if (window.THREE) return resolve();
  const s = document.createElement("script"); s.src = THREE_URL; s.onload = () => resolve(); s.onerror = () => reject(new Error("Three.js failed to load from " + THREE_URL));
  document.head.appendChild(s);
});
