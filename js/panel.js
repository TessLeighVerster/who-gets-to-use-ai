/* The side panel (bottom sheet on phones): legend, tabs, search, the Usage / Spend / Access lists, the country,
   continent and data-centre cards, pins, and the live counters. select() and selectDC() live here because they
   render the card; the globe work they trigger (flyTo, arcs, focus) is imported from scene.js. */
import { $, clamp, lerp, fmtInt, fmtMoney, fmtM, hexCss } from "./util.js";
import { PROVIDERS, PROVIDER_LABEL, PROVIDER_COLOR, OPERATORS, OPERATOR_LABEL, OPERATOR_COLOR, CONTINENT_COLOR } from "./colors.js";
import { DATA, CONTINENTS, YEARS, PROMPTS_PER_SECOND } from "./model.js";
import { state, view, COARSE, TAP } from "./state.js";
import { sfx } from "./sfx.js";
import { detectCountry } from "./geo.js";
import { shareCountry } from "./shareCard.js";
import { writeUrlState } from "./urlState.js";
import { MAX_BRICKS, DC_BRICK, CITY_BRICK, CITY_SLOTS, cityTowers, brickColors, cityObjects, showCities, setFocus, setTowerTint, clearArcs, showArcs, placeRing, placeRingAt, flyTo, fitDistFor, isNarrow, resize, setMode, markSelected } from "./scene.js";

if (COARSE){ const sub = $("#v-usage p.sub"); sub.textContent = sub.textContent.replace("Click", "Tap"); }


/* =====================================================================================
   SIDE PANEL UI
   ===================================================================================== */
/* the visitor's own country (time zone / language, see js/geo.js) and the top country by usage index, for the "Your country" strip */
const MY_ISO = detectCountry(new Set(DATA.countries.map(c => c.iso)));
const topCountry = () => DATA.countries.reduce((a, b) => (b.usageIndex > a.usageIndex ? b : a), DATA.countries[0]);
const estSpan = (c, field, html) => (c.provenance && c.provenance[field] && c.provenance[field].estimated) ? `<span class="est" title="Modelled estimate, not a sourced figure">${html}<sup>est.</sup></span>` : html;
/* legend */
$("#lg-prov").innerHTML = PROVIDERS.map(p => `<li><i class="sw" style="background:${hexCss(PROVIDER_COLOR[p])}"></i>${PROVIDER_LABEL[p]}</li>`).join("");
$("#lg-op").innerHTML = OPERATORS.map(o => `<li><i class="sw dc" style="background:${hexCss(OPERATOR_COLOR[o])};color:${hexCss(OPERATOR_COLOR[o])}"></i>${OPERATOR_LABEL[o]}</li>`).join("");

/* phones: the sheet slides up under the finger when a tower is tapped, so a second quick tap would land on a tab or a row and send the user elsewhere; the sheet ignores taps for its first half second */
let sheetOpenedAt = -1e9;
function openSheet(){ const p = $("#panel"); if (isNarrow() && p.classList.contains("strip")) sheetOpenedAt = performance.now(); p.classList.remove("strip"); }
$("#panel").addEventListener("click", e => { if (isNarrow() && performance.now() - sheetOpenedAt < 600){ e.stopPropagation(); e.preventDefault(); } }, true);
/* tabs */
function syncSheet(){ const open = isNarrow() && !$("#panel").classList.contains("strip"); document.body.classList.toggle("sheet-open", open); resize(); }
function showTab(name){
  state.tab = name; writeUrlState({ tab: name });
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "v-"+name));
  $("#content").scrollTop = 0;
  if (isNarrow()) $("#panel").classList.remove("strip");
  syncSheet();
}
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => { if (state.selected) select(null, true); showTab(b.dataset.tab); }));
function toggleTicker(){ document.body.classList.toggle("noticker"); }
$("#tickerHide").addEventListener("click", toggleTicker);
$("#tickerShow").addEventListener("click", toggleTicker);
/* phones: drag the sheet by its header (grabber or tabs). It follows the finger; a flick, or letting go past halfway, opens or tucks it away. */
{ let sy = null, sx = 0, t0 = 0, startStrip = false, moved = false, pid = null; const head = $("#panel .head"), panel = $("#panel");
  const closedY = () => panel.offsetHeight - 60;
  head.addEventListener("pointerdown", e => { if (!isNarrow() || panel.classList.contains("kb")) return; sy = e.clientY; sx = e.clientX; t0 = performance.now(); startStrip = panel.classList.contains("strip"); moved = false; pid = e.pointerId; });
  head.addEventListener("pointermove", e => {
    if (sy === null || e.pointerId !== pid) return;
    const dy = e.clientY - sy;
    if (!moved){ if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(e.clientX - sx)) return; moved = true; try { head.setPointerCapture(pid); } catch(_){} }
    const y = clamp((startStrip ? closedY() : 0) + dy, 0, closedY());
    panel.style.transition = "none"; panel.style.transform = `translateY(${y}px)`;
  });
  const end = e => {
    if (sy === null || e.pointerId !== pid) return;
    const dy = e.clientY - sy, dt = Math.max(1, performance.now() - t0); sy = null; pid = null;
    panel.style.transition = ""; panel.style.transform = "";
    if (!moved) return;
    const flick = Math.abs(dy)/dt > 0.45, far = Math.abs(dy) > 0.25*closedY();   // a flick, or a quarter of the travel, is enough to change state
    const strip = flick ? dy > 0 : far ? dy > 0 : startStrip;
    panel.classList.toggle("strip", strip); syncSheet();
    setTimeout(() => moved = false, 0);   // swallow only the click that belongs to this drag
  };
  head.addEventListener("pointerup", end); head.addEventListener("pointercancel", end);
  head.addEventListener("click", e => { if (moved){ e.stopPropagation(); e.preventDefault(); } }, true);   // a drag that ends over a tab is not a tab press
}
/* key tab (phones only): the legend lives inside the panel there */
$("#v-key .keywrap").innerHTML = $("#legend").innerHTML;
/* search */
const searchEl = $("#search"), searchDC = $("#searchDC"), searchEmpty = $("#searchEmpty");
function runSearch(){
  const q = searchEl.value.trim().toLowerCase();
  document.body.classList.toggle("searching", !!q);
  if (q && (state.tab !== "usage" || state.selected || state.selectedDC)){ if (state.selected || state.selectedDC) select(null, true); showTab("usage"); }
  let n = 0;
  $("#usageList").querySelectorAll(".row").forEach(li => {
    const c = DATA.countries.find(x => x.iso === li.dataset.iso);
    const hit = !q || c.name.toLowerCase().includes(q) || c.iso.toLowerCase() === q || c.continent.toLowerCase().includes(q);
    li.style.display = hit ? "" : "none"; if (hit) n++;
  });
  const dcs = q ? DATA.datacentres.filter(d => d.city.toLowerCase().includes(q) || d.name.toLowerCase().includes(q) || OPERATOR_LABEL[d.operator].toLowerCase().includes(q)).slice(0, 8) : [];
  searchDC.innerHTML = dcs.map(d => `<li class="row dcrow" data-dc="${d.name}"><span class="rk"><i class="sw dc" style="background:${hexCss(OPERATOR_COLOR[d.operator])};color:${hexCss(OPERATOR_COLOR[d.operator])}"></i></span><span class="nm">${d.city}<span class="sub2">${d.name} · ${OPERATOR_LABEL[d.operator]} data centre</span></span><span class="v"></span></li>`).join("");
  $("#searchDCHead").style.display = dcs.length ? "" : "none";
  searchEmpty.style.display = q && !n && !dcs.length ? "" : "none";
}
searchEl.addEventListener("input", runSearch);
searchEl.addEventListener("focus", () => { if (isNarrow()){ $("#panel").classList.remove("strip"); syncSheet(); } });
/* phones: while the keyboard is up, the sheet fills the visible part of the screen so search results are not hidden behind it */
if (window.visualViewport){
  const vv = window.visualViewport, panel = $("#panel");
  const fit = () => {
    const kb = window.innerHeight - vv.height - vv.offsetTop;
    const on = isNarrow() && kb > 120 && document.activeElement === searchEl;
    if (on){ panel.style.setProperty("--kbtop", (vv.offsetTop + 8) + "px"); panel.style.setProperty("--kbh", (vv.height - 16) + "px"); panel.classList.add("kb"); panel.classList.remove("strip"); }
    else panel.classList.remove("kb");
    syncSheet();
  };
  vv.addEventListener("resize", () => { resize(); fit(); }); vv.addEventListener("scroll", fit);
  searchEl.addEventListener("blur", () => setTimeout(fit, 60));
}
searchEl.addEventListener("keydown", e => {
  if (e.key === "Enter"){
    const first = $("#usageList").querySelector(".row:not([style*='none'])") || searchDC.querySelector(".row");
    if (!first) return;
    if (first.dataset.dc) selectDC(DATA.datacentres.find(d => d.name === first.dataset.dc));
    else { if (state.mode === "continents") setMode("countries"); select(DATA.countries.find(c => c.iso === first.dataset.iso)); }
    searchEl.blur();
  } else if (e.key === "Escape"){ searchEl.value = ""; runSearch(); searchEl.blur(); }
  e.stopPropagation();
});
searchDC.addEventListener("click", e => { const li = e.target.closest(".row"); if (li) selectDC(DATA.datacentres.find(d => d.name === li.dataset.dc)); });
$("#collapse").addEventListener("click", () => {
  if (isNarrow()) $("#panel").classList.toggle("strip");
  else document.body.classList.toggle("pcol");
  $("#collapse").textContent = document.body.classList.contains("pcol") ? "‹" : "›";
  syncSheet(); resize();
});

/* usage tab */
const rowHTML = (c, i, val, max, cls) => `<li class="row ${cls||""}" data-iso="${c.iso}"><span class="rk">${i+1}</span><span class="nm">${c.name}<span class="bar"><i style="transform:scaleX(${(val/max).toFixed(3)})"></i></span></span><span class="v">${Math.round(val)}</span></li>`;
{
  const sorted = [...DATA.countries].sort((a,b)=>b.usageIndex-a.usageIndex);
  $("#usageList").innerHTML = sorted.map((c,i) => rowHTML(c,i,c.usageIndex,100, c.usageIndex<10?"low":"")).join("");
}
/* access tab */
{
  const sorted = [...DATA.countries].sort((a,b)=>b.access-a.access);
  $("#accessMost").innerHTML = sorted.slice(0,10).map((c,i)=>rowHTML(c,i,c.access,100)).join("");
  $("#accessLeast").innerHTML = sorted.slice(-10).reverse().map((c,i)=>rowHTML(c,i,c.access,100)).join("");
  $("#accessFormula").innerHTML = `<b>How the score is built:</b> 40% usage index + 20% data centres in-country (capped at 4) + 20% internet penetration + 20% affordability, where affordability is 1 − (a $20/month plan as a share of median income, capped at 40%).`;
}
document.querySelectorAll(".rows").forEach(ul => ul.addEventListener("click", e => {
  const li = e.target.closest(".row"); if (!li) return;
  const c = DATA.countries.find(x => x.iso === li.dataset.iso);
  if (state.mode === "continents") setMode("countries");
  select(c);
}));
/* spend tab */
const SEC_PER_YEAR = 31557600, t0 = performance.now();
{
  const total = CONTINENTS.reduce((s,k)=>s+DATA.continents[k].annualSpendUSD,0);
  $("#spendStack").innerHTML = CONTINENTS.map(k => `<i style="flex:${DATA.continents[k].annualSpendUSD};background:${CONTINENT_COLOR[k]}" title="${k}"></i>`).join("");
  $("#spendList").innerHTML = CONTINENTS.map(k => `<li><span class="dot" style="background:${CONTINENT_COLOR[k]}"></span><span>${k}</span><span class="amt">$${DATA.continents[k].annualSpendUSD} B <span style="color:var(--muted);font-weight:500">· ${Math.round(100*DATA.continents[k].annualSpendUSD/total)}%</span></span></li>`).join("");
  $("#spendLive").innerHTML = CONTINENTS.map(k => `<li><span class="dot" style="background:${CONTINENT_COLOR[k]}"></span><span>${k}</span><span class="cnt" id="live-${k.replace(/\s/g,"")}">$0</span></li>`).join("");
}
const liveEls = CONTINENTS.map(k => [k, document.getElementById("live-"+k.replace(/\s/g,"")), DATA.continents[k].annualSpendUSD*1e9/SEC_PER_YEAR]);
const spendTotalEl = $("#spendTotal"), promptsEl = $("#prompts");
let lastTick = 0;
function tickCounters(now){
  if (now - lastTick < 100) return; lastTick = now;
  const s = (now - t0)/1000; let total = 0;
  for (const [,el,rate] of liveEls){ const v = rate*s; total += v; el.textContent = fmtMoney(v); }
  spendTotalEl.textContent = fmtMoney(total);
  promptsEl.textContent = fmtInt(PROMPTS_PER_SECOND*s);
}

/* country / continent card */
const cardEl = $("#v-card");
function cardHTML(r){
  const shares = PROVIDERS.filter(p => (r.providerShare[p]||0) >= 0.005);
  const bricks = shares.map(p => `<div class="brick" style="flex:${(r.providerShare[p]*100).toFixed(1)};background:${hexCss(PROVIDER_COLOR[p])}" title="${PROVIDER_LABEL[p]} ${Math.round(r.providerShare[p]*100)}%"></div>`).join("");
  const bl = shares.map(p => `<span><i style="background:${hexCss(PROVIDER_COLOR[p])}"></i>${PROVIDER_LABEL[p]} ${Math.round(r.providerShare[p]*100)}%</span>`).join("");
  const isPinned = state.pinned.includes(r);
  let stats, facts = "", actions;
  if (r.isContinent){
    stats = [[r.usageIndex.toFixed(1),"","usage index, population-weighted"],[fmtM(r.activeUsers),"","active users"],["$"+r.spend+" B","","annual AI spend"],[r.dcCount,"","data centres shown"]];
    actions = `<button class="btn" id="backBtn">Back to list</button>`;
  } else {
    stats = [[r.usageIndex,"","usage index (top country = 100)"],[fmtM(r.activeUsers),"","active users"],[Math.round(r.internetPenetration*100),"%","internet penetration"],[r.subscriptionShareOfIncome,"%","of median income for a $20/month plan"],
             [Math.round(r.electricityAccess*100),"%","of people have electricity at home"],["$"+r.dataCostPerGB.toFixed(2),"/GB","mobile data · "+(r.dataCostPerGB*r.subscriptionShareOfIncome/20).toFixed(2)+"% of monthly income"]];
    const dcs = DATA.datacentres.filter(d => d.iso === r.iso);
    const hours = 173*r.subscriptionShareOfIncome/100, us = DATA.countries.find(x => x.iso === "US"), usHours = 173*us.subscriptionShareOfIncome/100;
    const workStr = hours < 1 ? Math.round(hours*60)+" minutes" : hours < 16 ? hours.toFixed(1)+" hours" : Math.round(hours)+" hours";
    const days = hours/8, gb = 20/r.dataCostPerGB;
    const cities = cityObjects(r), natl = r.usageIndex;
    const cityHtml = cities.length > 1 ? `<h3 class="sech">Cities · usage per person</h3><ul class="rows cities">${cities.map((ct,i) => `<li class="row" data-city="${i}"><span class="rk">${i+1}</span><span class="nm">${ct.name}<span class="bar"><i style="transform:scaleX(${Math.min(1, ct.usageIndex/Math.max(natl*4, cities[0].usageIndex)).toFixed(3)})"></i></span><span class="sub2">${ct.rel.toFixed(1)}× national · ≈${fmtM(ct.activeUsers)} users · ${ct.population >= 1 ? ct.population.toFixed(1)+" M" : Math.round(ct.population*1000)+" k"} people</span></span><span class="v">${Math.round(ct.usageIndex)}</span></li>`).join("")}</ul>
      <p class="tiny">National index ${natl}. Thin towers on the globe show the top ${Math.min(cities.length, CITY_SLOTS)} cities at the same scale as the country tower. ${TAP} a city to fly there.</p>` : "";
    const buys = cityHtml + `<h3 class="sech">What $20 buys here</h3><div class="buys"><div class="big">${workStr}<small> of work at the median wage</small></div>
      <div class="cmp"><span>${r.iso === "US" ? "the benchmark" : (hours/usHours).toFixed(hours/usHours >= 10 ? 0 : 1)+"× longer than in the US ("+Math.round(usHours*60)+" min)"}</span></div>
      <div class="bar"><i style="width:${Math.min(100, 100*Math.log10(1+hours)/Math.log10(1+90)).toFixed(1)}%"></i></div>
      <ul><li>${days >= 1 ? days.toFixed(1)+" working days" : Math.round(hours*60)+" minutes"} of a month's pay</li><li>or ${gb >= 100 ? Math.round(gb) : gb.toFixed(0)} GB of mobile data</li><li>${(r.subscriptionShareOfIncome).toFixed(1)}% of a median month's income</li></ul></div>`;
    const routes = `<h3 class="sech">Where its prompts likely travel</h3><ul class="facts routes">${r.servedBy.map(d => `<li style="--dot:${hexCss(OPERATOR_COLOR[d.operator])}"><button class="lnk" data-dc="${d.name}">${d.city}</button> <span>· ${OPERATOR_LABEL[d.operator]}${d.iso === r.iso ? " · in-country" : d.name === "us-east-1" ? " · frontier models" : " · nearest region"}</span></li>`).join("")}</ul><p class="tiny">Arcs on the globe show these routes. Illustrative: real routing depends on the provider and product.</p>`;
    facts = buys + routes + `<h3 class="sech">Capabilities</h3><ul class="facts caps">${r.capabilities.map(f => `<li>${f}</li>`).join("")}${dcs.length ? `<li class="dcl">${dcs.length} data centre${dcs.length===1?"":"s"} on the globe: ${dcs.map(d => `<button class="lnk" data-dc="${d.name}">${d.name} <span>(${OPERATOR_LABEL[d.operator]}, ${d.city})</span></button>`).join(", ")}</li>` : ""}</ul>
             <h3 class="sech">What holds adoption back</h3><ul class="facts bars">${r.barriers.map(f => `<li>${f}</li>`).join("")}</ul>
             <h3 class="sech">Notes</h3><ul class="facts">${r.facts.map(f => `<li>${f}</li>`).join("")}</ul>`;
    actions = `<button class="btn ${isPinned?"":"primary"}" id="pinBtn">${isPinned?"Unpin":"Pin"}</button><button class="btn" id="shareBtn">Share ${r.name}'s card</button><button class="btn" id="backBtn">Back to list</button>`;
  }
  const top = topCountry();
  const mine = !r.isContinent && r.iso === MY_ISO ? `<div class="mine">You're in <b>${r.name}</b>. Usage index ${estSpan(r, "usageIndex", Math.round(r.usageIndex))} out of 100 (top country: ${top.name}). A $20/month AI plan costs ${estSpan(r, "subscriptionShareOfIncome", r.subscriptionShareOfIncome + "%")} of monthly income here — ${estSpan(top, "subscriptionShareOfIncome", top.subscriptionShareOfIncome + "%")} in ${top.name}.</div>` : "";
  return mine + `<div class="top"><div><h2>${r.name}</h2><div class="cont">${r.isContinent ? r.countries+" countries · "+fmtInt(r.population)+" M people" : r.continent+" · "+fmtInt(r.population)+" M people · "+r.dcCount+" data centre"+(r.dcCount===1?"":"s")+" shown"}</div></div><button class="x" id="closeCard" aria-label="Close">×</button></div>
    <div class="bricks">${bricks}</div><div class="blegend">${bl}</div>
    <div class="stats">${stats.map(([n,u,l]) => `<div class="stat"><div class="n">${n}<small>${u}</small></div><div class="l">${l}</div></div>`).join("")}</div>
    ${facts}<div class="actions">${actions}</div>`;
}
function select(ref, keepTab, switching){
  const prev = state.selected;
  if (prev && prev._tower && prev._tower !== state.hovered) setTowerTint(prev._tower, false);
  state.selected = ref || null; state.selectedDC = null; state.selectedCity = null;
  writeUrlState({ country: ref && !ref.isContinent ? ref.iso : null });
  if (!ref || ref.isContinent){ showCities(null); setFocus(null); }
  document.querySelectorAll(".row.sel").forEach(el => el.classList.remove("sel"));
  clearArcs();
  if (!ref){
    placeRing(null);
    if (prev || state.selectedDC) sfx.close();
    if (view.autoPan && !switching){ view.tPanX = view.tPanY = 0; view.autoPan = false; if (view.restoreDist){ view.tDist = view.restoreDist; view.restoreDist = 0; } }
    if (!keepTab){ document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "v-"+state.tab)); }
    return;
  }
  const t = ref._tower; placeRing(t); markSelected();
  if (!view.autoPan) view.restoreDist = view.tDist;   // remember the zoom we came from, restored when the card closes
  sfx.select();
  if (!ref.isContinent){ showCities(ref); setFocus([t, ...cityTowers, ...state.pinned.map(p => p._tower)]); }
  if (!ref.isContinent) showArcs(ref.servedBy.map(d => ({from:t.pos, to:d._pos, color:OPERATOR_COLOR[d.operator], dc:d})));
  const L = t.n * ref.growthCurve[state.year] * t.dims.h;                                  // this tower's height once settled
  const Lmax = Math.max(L, ...cityTowers.map(ct => ct.n * ct.dims.h * (ct.cityOf === ref ? ref.growthCurve[state.year] : 0)));
  flyTo(ref, fitDistFor(ref.isContinent ? L : Lmax), L);                                  // whole tower in frame, its midpoint dead centre
  cardEl.innerHTML = cardHTML(ref);
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "v-card"));
  document.querySelectorAll(`.row[data-iso="${ref.iso}"]`).forEach(el => el.classList.add("sel"));
  $("#content").scrollTop = 0;
  openSheet();
  syncSheet();
  $("#closeCard").onclick = () => select(null);
  $("#backBtn").onclick = () => select(null);
  const wireDC = () => { cardEl.querySelectorAll("[data-dc]").forEach(b => b.onclick = () => selectDC(DATA.datacentres.find(d => d.name === b.dataset.dc)));
    cardEl.querySelectorAll("[data-city]").forEach(li => li.onclick = () => focusCity(ref, +li.dataset.city)); };
  wireDC();
  const wireShare = () => { const sb = $("#shareBtn"); if (sb) sb.onclick = async () => { sb.disabled = true; try { await shareCountry(ref); } finally { sb.disabled = false; } }; };
  wireShare();
  const pb = $("#pinBtn"); if (pb) pb.onclick = () => { togglePin(ref); cardEl.innerHTML = cardHTML(ref); $("#closeCard").onclick = () => select(null); $("#backBtn").onclick = () => select(null); $("#pinBtn").onclick = pb.onclick; wireDC(); wireShare(); };
}

/* fly to one city inside the selected country */
function focusCity(c, idx){
  const city = cityObjects(c)[idx]; if (!city) return;
  state.selectedCity = city;
  cardEl.querySelectorAll("[data-city]").forEach(li => li.classList.toggle("sel", +li.dataset.city === idx));
  const t = city._tower;
  const L = t ? t.n*t.dims.h*c.growthCurve[state.year] : 0;
  if (t) setFocus([t, c._tower, ...state.pinned.map(p => p._tower)]);
  if (t) placeRingAt(t.pos, t.quat, CITY_BRICK.w*1.8);
  flyTo(city, fitDistFor(L), L);
  sfx.pin();
}

/* data-centre card */
const EXTRA_COUNTRY = {BH:"Bahrain", QA:"Qatar", BE:"Belgium"};
const _dq = new THREE.Quaternion(), _dn = new THREE.Vector3(), _dup = new THREE.Vector3(0,1,0);
function selectDC(d){
  const hadSel = !!(state.selected || state.selectedDC);
  select(null, true, true); state.selectedDC = d; markSelected();
  if (!hadSel) view.restoreDist = view.tDist;
  sfx.select();
  const c = DATA.countries.find(x => x.iso === d.iso), cname = c ? c.name : (EXTRA_COUNTRY[d.iso] || d.iso);
  showArcs(d.serves.slice(0,14).map(cc => ({from:d._pos, to:cc._tower.pos, color:OPERATOR_COLOR[d.operator], dc:d})));
  _dn.copy(d._pos).normalize(); _dq.setFromUnitVectors(_dup, _dn); placeRingAt(d._pos, _dq, DC_BRICK.w*1.6);
  flyTo(d, Math.min(view.tDist, lerp(view.minDist, view.maxDist, 0.25)), 0);
  const col = hexCss(OPERATOR_COLOR[d.operator]);
  cardEl.innerHTML = `<div class="top"><div><div class="kicker" style="color:${col}"><i class="sw dc" style="background:${col};color:${col}"></i>${OPERATOR_LABEL[d.operator]} data centre</div><h2>${d.name}</h2><div class="cont">${d.city} · ${cname}</div></div><button class="x" id="closeCard" aria-label="Close">×</button></div>
    <ul class="facts"><li>${d.note}</li></ul>
    ${c ? `<h3 class="sech">${c.name} at a glance</h3><div class="stats"><div class="stat"><div class="n">${c.usageIndex}</div><div class="l">usage index</div></div><div class="stat"><div class="n">${c.dcCount}</div><div class="l">data centres shown in-country</div></div><div class="stat"><div class="n">${Math.round(c.electricityAccess*100)}<small>%</small></div><div class="l">have electricity</div></div><div class="stat"><div class="n">$${c.dataCostPerGB.toFixed(2)}<small>/GB</small></div><div class="l">mobile data</div></div></div>
    <h3 class="sech">What holds adoption back here</h3><ul class="facts bars">${c.barriers.map(f => `<li>${f}</li>`).join("")}</ul>` : `<p class="sub">${cname} is not one of the ${DATA.countries.length} countries in the usage data set.</p>`}
    <div class="actions">${c ? `<button class="btn primary" id="toCountry">Open ${c.name}</button>` : ""}<button class="btn" id="backBtn">Back to list</button></div>`;
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "v-card"));
  $("#content").scrollTop = 0;
  openSheet();
  syncSheet();
  $("#closeCard").onclick = () => select(null); $("#backBtn").onclick = () => select(null);
  const tc = $("#toCountry"); if (tc) tc.onclick = () => select(c);
}

/* pins: up to two countries side by side at the same scale */
function togglePin(c){
  const i = state.pinned.indexOf(c);
  if (i >= 0) state.pinned.splice(i,1); else { state.pinned.push(c); if (state.pinned.length > 2) state.pinned.shift(); }
  sfx.pin();
  if (state.selected && !state.selected.isContinent) setFocus([state.selected._tower, ...cityTowers, ...state.pinned.map(p => p._tower)]);
  drawPins();
}
$("#clearPins").addEventListener("click", () => { state.pinned = []; drawPins(); if (state.selected) { cardEl.innerHTML = cardHTML(state.selected); select(state.selected, true); } });
function drawPins(){
  const box = $("#pins"); box.classList.toggle("show", state.pinned.length > 0);
  if (!state.pinned.length) return;
  const svg = $("#pinsvg"), W = 380, H = 170, baseY = 132, maxH = 112, bw = 44;
  const g = state.pinned.map(c => c.growthCurve[state.year]);
  const counts = state.pinned.map(c => Math.max(c.usageIndex>0?1:0, Math.round(c.usageIndex/100*MAX_BRICKS*1)));
  const bh = Math.floor(maxH/MAX_BRICKS), gap = 1;
  let out = `<line x1="20" x2="${W-20}" y1="${baseY+0.5}" y2="${baseY+0.5}" stroke="rgba(255,255,255,.18)"/>`;
  state.pinned.forEach((c,i) => {
    const cx = state.pinned.length === 2 ? (i===0 ? W*0.3 : W*0.7) : W/2;
    const cols = brickColors(c, counts[i]); const shown = Math.round(counts[i]*g[i]);
    cols.slice(0, shown).forEach((hex,k) => {
      const y = baseY - (k+1)*bh + gap;
      out += `<rect x="${cx-bw/2}" y="${y}" width="${bw}" height="${bh-gap}" rx="2" fill="${hexCss(hex)}"/>`;
      out += `<rect x="${cx-bw/2+8}" y="${y-2}" width="8" height="2.5" rx="1" fill="${hexCss(hex)}" opacity=".9"/><rect x="${cx+bw/2-16}" y="${y-2}" width="8" height="2.5" rx="1" fill="${hexCss(hex)}" opacity=".9"/>`;
    });
    if (shown === 0) out += `<rect x="${cx-bw/2}" y="${baseY-2}" width="${bw}" height="2" fill="rgba(255,255,255,.25)"/>`;
    out += `<text x="${cx}" y="${baseY+20}" text-anchor="middle">${c.name}</text><text class="m" x="${cx}" y="${baseY+36}" text-anchor="middle">index ${Math.round(c.usageIndex*g[i])} · ${fmtM(c.activeUsers*g[i])} users</text>`;
  });
  if (state.pinned.length === 2){
    const a = state.pinned[0].usageIndex*g[0], b = state.pinned[1].usageIndex*g[1], lo = Math.min(a,b), hi = Math.max(a,b);
    out += `<text class="m" x="${W/2}" y="24" text-anchor="middle" style="font-size:13px;fill:var(--accent)">${lo>0 ? (hi/lo).toFixed(hi/lo>=10?0:1)+"× gap" : "no usage to compare"} · ${YEARS[state.year]}</text>`;
  }
  svg.innerHTML = out;
}

export { openSheet, syncSheet, showTab, toggleTicker, searchEl, runSearch, tickCounters, cardHTML, select, focusCity, selectDC, togglePin, drawPins };
