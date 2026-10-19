/* Analytics: GoatCounter (goatcounter.com). Cookieless, no personal data stored, so no consent banner is needed.
   index.html loads the counter script, which records one page view per visit on its own; this module adds a few
   named events on top and never throws. Country opens are sent as views of /c/{iso}/ so the dashboard's Pages list
   doubles as a "most viewed countries" list. Nothing is sent with ?debug, and GoatCounter itself ignores localhost. */
const DEBUG = new URLSearchParams(location.search).has("debug");
function send(path, title, event){
  try {
    const gc = window.goatcounter;
    if (DEBUG || !gc || typeof gc.count !== "function") return;
    gc.count({ path, title, event });
  } catch (_) {}
}
/* a named event, e.g. track("share"), track("tab-usage") */
export function track(name){ send(name, undefined, true); }
/* a country card opened */
export function trackCountry(iso, name){ send("/c/" + iso + "/", name, false); }
