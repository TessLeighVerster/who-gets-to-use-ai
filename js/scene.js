/* Everything drawn with Three.js and everything that reads the pointer: the globe, land dots and data layers,
   the towers (two InstancedMeshes), arcs, the selection ring, the camera (applyView, flyTo, zoom, pan, resize),
   hit testing (castAt, hitTest), pointer and keyboard interaction (endPointer), the easter eggs and the nav pad.
   THREE is the global from the cdnjs script tag in index.html. */
import { $, clamp, lerp, easeOutBack, easeInOutCubic, fmtM, deg, latLonToVec, hexCss } from "./util.js";
import { PROVIDERS, PROVIDER_COLOR, OPERATOR_COLOR, OPERATOR_LABEL } from "./colors.js";
import { DATA, CONTINENTS, CONT } from "./model.js";
import { state, view, COARSE } from "./state.js";
import { sfx } from "./sfx.js";
import { writeUrlState } from "./urlState.js";
import { createArcs } from "./arcs.js";
import { select, selectDC, focusCity, syncSheet, searchEl, toggleTicker } from "./panel.js";

/* Land mask: 180 columns × 90 rows, 2° cells. Row 0 is lat +90..+88, column 0 is lon -180..-178.
   '#' = land, '.' = water. Generated offline from coarse continent polygons; edit if you like. */
const LAND_MASK = [
"....................................................................................................................................................................................",
"....................................................................................................................................................................................",
"....................................................................................................................................................................................",
"...................................................................######...........................................................................................................",
"................................................###############################.....................................................................................................",
"...............................................#################################.................######.............................................................................",
".............................................####......##########################..........................................................####.....................................",
".............................................................####################.......................................##...........############...................................",
"............................#############....######...........##################.....................................###.........#####################..............................",
"..............................###########.....#######..........################.....................................##......###########################################.............",
"........##########################.###.........#########.......#############......................##########............##########################################################..",
".......###################################.......##########....##########........................#############..####################################################################",
".......####################################........#######......########......#####.............#####.#######..#####################################################################",
".......#####################################..........####.......######.......................#####..#############################################################################..",
"........####################################.......####...........####.......................######..###########################################################################....",
"..........####.......######################........#######...................................######...###########################################################.......####........",
"..........##..........######################.......########............................##.....#.##...###########################################################........###.........",
".......................#########################...#########...........................##.....#.....###########################################################.........##..........",
".........................########################..##########........................##.##..####################################################################.#......#...........",
"..........................####################################.........................###.#####################################################################.#..................",
"...........................#####################################........................########################################################################.#..................",
"............................###############################...#..........................######################################################################.....................",
"............................#############################................................################....####...##########################################...#..................",
"............................###########################..............................######....##.######.......##....#######################################....##..................",
"............................#########################................................######......##.###.##########...######################################.....#...................",
"............................#########################................................#####..........##.############..################################....##.....#...................",
".............................#######################.................................####....##........###########...################################....##...##....................",
"..............................######################...................................########.............##########################################...#..####....................",
"...............................###################....................................#########............###########################################.....#........................",
"................................#################....................................##############.#####..############################################.............................",
"..................................#########......#..................................######################.#######.####################################.............................",
"...................................#######.......#.................................########################.######....################################..............................",
"....................................#####.........................................#########################..######..##..############################.#.............................",
".....................................####.........................................##########################.##########.....#######################...#.............................",
"......................................####...#....##.............................###########################..#########.......#######...########....................................",
"......................................#####.##.......###..........................###########################.#########.......######.....######.#...................................",
".........................................#####....................................###########################..######.........#####......######.......#.............................",
"...........................................#####.................................#############################.####............###.........#####......#.............................",
"..............................................##..................................#############################.#..............###.........######...................................",
"...............................................#.....####.........................#################################.............##.........#.###.......##...........................",
"................................................###.#######........................################################.............#.#........#..#.........#...........................",
"...................................................##########.......................###############################...............#.........#.......................................",
"...................................................############.......................#......#####################..........................#......##...............................",
"...................................................##############..............................##################.........................####...####...............................",
"...................................................##############..............................#################...........................##....####...............................",
"..................................................################.............................################.............................##...####.#.............................",
"..................................................####################.........................###############..............................##...###........####....................",
".................................................#######################........................##############...............................##...............#####.................",
"..................................................######################........................##############.................................###.............######...............",
"...................................................#####################.........................#############........................................##...........##...............",
"...................................................#####################........................##############......................................................................",
"....................................................###################.........................##############....#........................................###...#..................",
".....................................................#################..........................##############...##......................................#####...##.................",
"......................................................################..........................#############...###.....................................###########.................",
"......................................................################..........................############....###...................................#############.................",
".......................................................###############...........................###########....##..................................#################...............",
".......................................................#############.............................##########.....##.................................###################..............",
".......................................................############..............................##########.....#..................................###################..............",
".......................................................###########................................########.........................................####################.............",
"......................................................###########.................................########.........................................####################.............",
"......................................................###########..................................######..........................................###################..............",
"......................................................##########...................................#####...........................................#####....##########..............",
"......................................................########................................................................................................########..............",
"......................................................#######...................................................................................................#####............#..",
"......................................................#####......................................................................................................................##.",
".....................................................#####......................................................................................................................##..",
".....................................................####..........................................................................................................#...........##...",
".....................................................####.....................................................................................................................##....",
".....................................................####...........................................................................................................................",
".....................................................###............................................................................................................................",
".....................................................###............................................................................................................................",
"......................................................##............................................................................................................................",
"....................................................................................................................................................................................",
"....................................................................................................................................................................................",
"....................................................................................................................................................................................",
"....................................................................................................................................................................................",
"....................................................................................................................................................................................",
"....................................................................................................................................................................................",
"..................................................................................................................................##############################....................",
".........................................................................................................##############################################################.............",
"##...................................................###.............................#######################################################################################........",
"#######...........................................########....................##################################################################################################....",
"############........########################################..............#######################################################################################################...",
"###################################################################################################################################################################################.",
"####################################################################################################################################################################################",
"####################################################################################################################################################################################",
"####################################################################################################################################################################################",
"####################################################################################################################################################################################",
"####################################################################################################################################################################################",
"####################################################################################################################################################################################"
];

const R = 1;                      // globe radius
const MAX_BRICKS = 17;            // bricks for usageIndex 100  (17 × 0.02 ≈ 0.35 R)
const BRICK = { w:0.03, h:0.02, d:0.03, stud_r:0.0055, stud_h:0.005 };
const CONT_BRICK = { w:0.06, h:0.02, d:0.06, stud_r:0.011, stud_h:0.006 };
const DC_BRICK = { w:0.02, h:0.007, d:0.02 };
const isLand = (lat, lon) => {
  const row = clamp(Math.floor((90-lat)/2), 0, 89), col = clamp(Math.floor((lon+180)/2), 0, 179);
  return LAND_MASK[row].charCodeAt(col) === 35;
};

/* ---- renderer / scene ---- */
const canvas = $("#scene");
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, window.matchMedia("(max-width:900px)").matches ? 1.5 : 2));   // lighter on phones
renderer.setClearColor(0x15171c, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
const world = new THREE.Group();   // everything that rotates
scene.add(world);

/* lighting: one warm key light and one cool, low hemisphere fill. No shadows, no point lights. */
const key = new THREE.DirectionalLight(0xfff1dc, 1.75); key.position.set(-2.5, 3, 4); scene.add(key);
const hemi = new THREE.HemisphereLight(0x9fb0cf, 0x2b2a30, 0.8); scene.add(hemi);

/* quality tier: "low" on phones (small viewport at 2x+), on <=4-core devices, or when the first 60 frames average under
   50 fps (js/main.js calls setQuality); "high" otherwise. ?quality=low|high overrides. Low = high minus the textures. */
const QUALITY_PARAM = new URLSearchParams(location.search).get("quality");
const phoneLike = window.innerWidth*window.innerHeight < 520000 && (window.devicePixelRatio||1) >= 2;
const quality = { tier: QUALITY_PARAM === "low" || QUALITY_PARAM === "high" ? QUALITY_PARAM : (phoneLike || (navigator.hardwareConcurrency||8) <= 4 ? "low" : "high"), forced: QUALITY_PARAM === "low" || QUALITY_PARAM === "high" };

/* the few shared textures, all generated on a canvas (no network): a 256² grey noise for roughness variation on the bricks,
   a 512² greyscale stud pattern for the baseplate (roughness + faint bump), a 64² radial gradient for contact discs */
function canvasTexture(size, draw, repeat){
  const cv = document.createElement("canvas"); cv.width = cv.height = size; draw(cv.getContext("2d"), size);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 2; return t;
}
const noiseTex = canvasTexture(256, (g, s) => { const img = g.createImageData(s, s), d = img.data; let seed = 11; const rnd = () => (seed = (seed*48271)%2147483647)/2147483647;
  for (let i = 0; i < s*s; i++){ const v = 150 + Math.floor(rnd()*70); d[i*4] = d[i*4+1] = d[i*4+2] = v; d[i*4+3] = 255; } g.putImageData(img, 0, 0); }, [6, 6]);
const studTex = canvasTexture(512, (g, s) => { g.fillStyle = "#b4b4b4"; g.fillRect(0, 0, s, s); const n = 8, cell = s/n;   // 8×8 studs per tile
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++){ const cx = (x+0.5)*cell, cy = (y+0.5)*cell, r = cell*0.3;
    const grd = g.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.1, cx, cy, r); grd.addColorStop(0, "#d8d8d8"); grd.addColorStop(0.75, "#c4c4c4"); grd.addColorStop(1, "#8c8c8c");
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI*2); g.fill(); } }, [48, 24]);
const discTex = canvasTexture(64, (g, s) => { const grd = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.55, "rgba(255,255,255,0.55)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, s, s); });

/* baseplate: a deep blue-charcoal plate with a low-contrast stud pattern (texture, not geometry) */
const plateMat = new THREE.MeshStandardMaterial({color:0x272b34, roughness:0.9, metalness:0, roughnessMap: quality.tier === "high" ? studTex : null, bumpMap: quality.tier === "high" ? studTex : null, bumpScale:0.0022});
const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), plateMat);
world.add(globe);
/* faint warm rim so the plate's edge separates from the near-black background */
const rim = new THREE.Mesh(new THREE.SphereGeometry(R*1.001, 96, 64), new THREE.ShaderMaterial({
  transparent:true, depthWrite:false,
  uniforms:{ c:{value:new THREE.Color(0xd9cdb8)} },
  vertexShader:`varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
  fragmentShader:`uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-max(dot(vN,vV),0.0),4.0); gl_FragColor=vec4(c*f*0.35,f*0.35); }`
}));
world.add(rim);
function setQuality(tier){
  quality.tier = tier;
  const hi = tier === "high";
  plateMat.roughnessMap = hi ? studTex : null; plateMat.bumpMap = hi ? studTex : null; plateMat.needsUpdate = true;
  brickMat.roughnessMap = hi ? noiseTex : null; brickMat.flatShading = !hi; brickMat.needsUpdate = true;
  dcMat.roughnessMap = hi ? noiseTex : null; dcMat.flatShading = !hi; dcMat.needsUpdate = true;
}


/* data layers for the land dots. Bands are tested in order; the on-screen key is generated from the same table. */
const LAYERS = {
  power: { title:"Electricity at home", sub:"share of people with power · land dots recoloured", note:"Each dot takes the value of the nearest listed country.",
    bands:[ {test:c=>c.electricityAccess>=0.95, hex:0xfff2b0, label:"95–100%", examples:"most of the world"},
            {test:c=>c.electricityAccess>=0.8,  hex:0xe8b34a, label:"80–95%",  examples:"South Africa, Ghana, Nepal"},
            {test:c=>c.electricityAccess>=0.6,  hex:0xd9822b, label:"60–80%",  examples:"Kenya, Senegal, Nigeria"},
            {test:c=>c.electricityAccess>=0.4,  hex:0xb4472a, label:"40–60%",  examples:"Ethiopia, Rwanda, Uganda"},
            {test:c=>true,                      hex:0x6b1f1f, label:"under 40%", examples:"Tanzania, DR Congo"} ] },
  data: { title:"Mobile data cost", sub:"price of 1 GB · land dots recoloured", note:"Sticker price. Switch to “% of income” to see what it means for people.",
    modes:[["data","$ per GB"],["dataShare","% of income"]],
    bands:[ {test:c=>c.dataCostPerGB<0.5,  hex:0x3ddc84, label:"under $0.50", examples:"India, Israel, Italy, Poland"},
            {test:c=>c.dataCostPerGB<1,    hex:0x3b82f6, label:"$0.50–1",     examples:"UK, Brazil, Kenya, Egypt"},
            {test:c=>c.dataCostPerGB<2,    hex:0xffd23f, label:"$1–2",        examples:"Netherlands, Korea, South Africa"},
            {test:c=>c.dataCostPerGB<4,    hex:0xff5a1f, label:"$2–4",        examples:"Germany, Japan, UAE, Mexico"},
            {test:c=>true,                 hex:0xe91e8c, label:"over $4",     examples:"US, Canada, Switzerland"} ] },
  dataShare: { title:"Mobile data cost", sub:"1 GB as a share of median monthly income", note:"Cheap in dollars can still be dear: 1 GB costs a Congolese household 2.5% of a month's income.",
    modes:[["data","$ per GB"],["dataShare","% of income"]],
    bands:[ {test:c=>c.dataCostPerGB*c.subscriptionShareOfIncome/20<0.1, hex:0x3ddc84, label:"under 0.1%", examples:"Europe, US, Korea, Israel"},
            {test:c=>c.dataCostPerGB*c.subscriptionShareOfIncome/20<0.3, hex:0x3b82f6, label:"0.1–0.3%",   examples:"India, Brazil, Turkey, Mexico"},
            {test:c=>c.dataCostPerGB*c.subscriptionShareOfIncome/20<0.6, hex:0xffd23f, label:"0.3–0.6%",   examples:"Nigeria, Kenya, Egypt, Pakistan"},
            {test:c=>c.dataCostPerGB*c.subscriptionShareOfIncome/20<1.2, hex:0xff5a1f, label:"0.6–1.2%",   examples:"Senegal, Tanzania, Ghana, Uganda"},
            {test:c=>true,                                               hex:0xe91e8c, label:"over 1.2%",  examples:"DR Congo, Ethiopia, Venezuela"} ] }
};
/* land: the country/continent geography as small flat discs lying on the plate. Positions: a Fibonacci sphere sampled
   against the mask, capped at 12,000 points. One InstancedMesh (one draw call); colour skins per data layer are applied
   with setColorAt only when a layer is switched, never per frame. */
let landDots;
{
  const N = 40000, CAP = 12000, tmp = new THREE.Vector3(), hits = [];
  const ga = Math.PI*(3-Math.sqrt(5));
  for (let i=0;i<N;i++){
    const y = 1-(i/(N-1))*2, rad = Math.sqrt(1-y*y), th = ga*i;
    const x = Math.cos(th)*rad, z = Math.sin(th)*rad;
    const lat = Math.asin(y)/deg, lon = Math.atan2(x, z)/deg;
    if (isLand(lat, lon)) hits.push(x,y,z);
  }
  const count = hits.length/3, keep = Math.min(1, CAP/count), pos = new Float32Array(Math.min(count,CAP)*3);
  let seed = 3, n = 0; const rnd = () => (seed = (seed*48271)%2147483647)/2147483647;
  for (let i=0;i<count && n<CAP;i++){ if (rnd() <= keep){ pos[n*3]=hits[i*3]; pos[n*3+1]=hits[i*3+1]; pos[n*3+2]=hits[i*3+2]; n++; } }
  // each dot takes the value of the nearest listed country (for the Power / Data cost skins)
  const cents = DATA.countries.map(c => latLonToVec(c.lat, c.lon, 1, new THREE.Vector3()));
  const owner = new Int16Array(n);
  for (let i=0;i<n;i++){
    const x = pos[i*3], y = pos[i*3+1], z = pos[i*3+2];
    let best = -1, bd = -2;
    for (let k=0;k<cents.length;k++){ const d = x*cents[k].x + y*cents[k].y + z*cents[k].z; if (d > bd){ bd = d; best = k; } }
    owner[i] = bd < Math.cos(24*deg) ? -1 : best;                              // far from any listed country: no data
  }
  const skins = {}, cc = new THREE.Color();
  const skin = (name, fn) => { const arr = new Float32Array(n*3); for (let i=0;i<n;i++){ cc.setHex(owner[i] < 0 ? (name === "plain" ? 0x474d5a : 0x343842) : fn(DATA.countries[owner[i]])); arr[i*3]=cc.r; arr[i*3+1]=cc.g; arr[i*3+2]=cc.b; } skins[name] = arr; };
  skin("plain", () => 0x474d5a);                                                 // faint: the geography reads without competing with the towers
  Object.keys(LAYERS).forEach(k => skin(k, c => LAYERS[k].bands.find(b => b.test(c)).hex));
  const discGeo = new THREE.CircleGeometry(1, 6); discGeo.rotateX(-Math.PI/2);   // flat hexagonal discs on the plate (6 triangles each: 12,000 dots = 72k triangles)
  landDots = new THREE.InstancedMesh(discGeo, new THREE.MeshBasicMaterial({color:0xffffff}), n);
  landDots.frustumCulled = false;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0,1,0), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i=0;i<n;i++){ p.set(pos[i*3], pos[i*3+1], pos[i*3+2]); q.setFromUnitVectors(up, tmp.copy(p).normalize()); s.setScalar(0.0062*R); M.compose(p.multiplyScalar(R*1.0015), q, s); landDots.setMatrixAt(i, M); }
  landDots.instanceMatrix.needsUpdate = true;
  const applySkin = name => { const arr = skins[name] || skins.plain; for (let i=0;i<n;i++) landDots.setColorAt(i, cc.setRGB(arr[i*3], arr[i*3+1], arr[i*3+2])); landDots.instanceColor.needsUpdate = true; };
  applySkin("plain");
  landDots.userData = { skins, applySkin };
  world.add(landDots);
}

function setLayer(name, quiet){
  if (!LAYERS[name]) name = "none";
  state.layer = name; writeUrlState({ layer: name });
  landDots.userData.applySkin(name === "none" ? "plain" : name);
  const group = name === "dataShare" ? "data" : name;
  document.querySelectorAll("#layerSeg button").forEach(b => b.classList.toggle("on", b.dataset.layer === group));
  const key = $("#powerKey"); key.classList.toggle("show", name !== "none");
  if (name !== "none"){
    const L = LAYERS[name];
    const strip = L.bands.map(b => `<i style="background:${hexCss(b.hex)}" title="${b.label}"></i>`).join("");
    key.innerHTML = `<button class="pkh" id="keyToggle" aria-expanded="${!state.keyCollapsed}" title="Show or hide the key"><span class="pkt"><b>${L.title}</b><span class="strip">${strip}<em>${L.bands[0].label} → ${L.bands[L.bands.length-1].label}</em></span><span class="sub">${L.sub}</span></span><span class="chev">›</span></button>` +
      `<div class="pkb">` +
      (L.modes ? `<div class="modes">${L.modes.map(m => `<button data-mode="${m[0]}" class="${m[0]===name?"on":""}">${m[1]}</button>`).join("")}</div>` : "") +
      `<ul>${L.bands.map(b => `<li><i style="background:${hexCss(b.hex)}"></i><b>${b.label}</b><span>${b.examples}</span></li>`).join("")}<li><i style="background:#2a2f3d"></i><b>no data</b><span>far from any listed country</span></li></ul><em>${L.note}</em></div>`;
    key.querySelectorAll("[data-mode]").forEach(b => b.onclick = e => { e.stopPropagation(); setLayer(b.dataset.mode); });
    key.classList.toggle("collapsed", !!state.keyCollapsed);
    $("#keyToggle").onclick = () => { state.keyCollapsed = !state.keyCollapsed; key.classList.toggle("collapsed", state.keyCollapsed); $("#keyToggle").setAttribute("aria-expanded", !state.keyCollapsed); try { localStorage.setItem("keyCollapsed", state.keyCollapsed ? "1" : "0"); } catch(_){} };
  }
  if (!quiet) sfx.toggle();
}
const setPowerMap = on => setLayer(on ? "power" : "none");

/* data centres: instanced small bricks in a slightly more saturated, slightly emissive version of the operator colour
   (emissive comes from the instance colour, at most 0.3). No halos, no point lights. */
const dcMat = new THREE.MeshStandardMaterial({roughness:0.4, metalness:0, roughnessMap: quality.tier === "high" ? noiseTex : null, flatShading: quality.tier === "low"});
dcMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance += vColor.rgb * 0.3;\n#endif"); };
const dcMesh = (() => {
  const geo = new THREE.BoxGeometry(1,1,1); geo.translate(0,0.5,0);
  const m = new THREE.InstancedMesh(geo, dcMat, DATA.datacentres.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(DC_BRICK.w, DC_BRICK.h, DC_BRICK.d), up = new THREE.Vector3(0,1,0), col = new THREE.Color();
  // bricks that would sit inside their country's tower are nudged a step sideways (spread around it) so they stay visible and clickable
  const cent = new THREE.Vector3(), east = new THREE.Vector3(), north = new THREE.Vector3(), nrm = new THREE.Vector3(), off = new THREE.Vector3(), Y = new THREE.Vector3(0,1,0);
  const crowd = {};
  DATA.datacentres.forEach(d => { const c = DATA.countries.find(x => x.iso === d.iso); if (!c) return; latLonToVec(d.lat, d.lon, 1, p); latLonToVec(c.lat, c.lon, 1, cent); if (p.angleTo(cent) < 0.045){ (crowd[d.iso] = crowd[d.iso] || []).push(d); } });
  Object.values(crowd).forEach(list => list.forEach((d,k) => { d._nudge = [k, list.length]; }));
  DATA.datacentres.forEach((d,i) => {
    latLonToVec(d.lat, d.lon, R, p);
    if (d._nudge){
      const [k, n] = d._nudge, ang = -Math.PI/2 + k*2*Math.PI/n;   // first one due east of the tower, others spread around it
      nrm.copy(p).normalize(); east.crossVectors(Y, nrm).normalize(); north.crossVectors(nrm, east);
      off.copy(east).multiplyScalar(Math.cos(ang)).addScaledVector(north, Math.sin(ang)).multiplyScalar(0.05);
      p.add(off).normalize().multiplyScalar(R);
    }
    q.setFromUnitVectors(up, p.clone().normalize());
    M.compose(p, q, s); m.setMatrixAt(i, M); m.setColorAt(i, col.setHex(OPERATOR_COLOR[d.operator]).offsetHSL(0, 0.08, 0.02));
    d._pos = p.clone();
  });
  m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; world.add(m);
  return m;
})();

/* =====================================================================================
   TOWERS  (two InstancedMeshes: bricks and studs; countries + continents share them)
   ===================================================================================== */
function brickColors(ref, n){
  // split n bricks by providerShare using largest-remainder so they sum to n, fixed provider order bottom→top
  const raw = PROVIDERS.map(p => (ref.providerShare[p]||0)*n), base = raw.map(Math.floor);
  let rem = n - base.reduce((a,b)=>a+b,0);
  raw.map((v,i)=>[v-base[i],i]).sort((a,b)=>b[0]-a[0]).slice(0,rem).forEach(([,i])=>base[i]++);
  const out = []; PROVIDERS.forEach((p,i) => { for (let k=0;k<base[i];k++) out.push(PROVIDER_COLOR[p]); });
  return out;
}
const CITY_SLOTS = 6, CITY_MAX_BRICKS = 26;
const CITY_BRICK = { w:0.014, h:0.02, d:0.014, stud_r:0.0028, stud_h:0.004 };
const towers = [], cityTowers = [];
{
  const up = new THREE.Vector3(0,1,0), tmp = new THREE.Vector3();
  let brickCursor = 0;
  const make = (ref, isContinent) => {
    const n = ref.usageIndex > 0 ? Math.max(1, Math.round(ref.usageIndex/100*MAX_BRICKS)) : 0;
    const pos = latLonToVec(ref.lat, ref.lon, R, new THREE.Vector3()), normal = pos.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
    const dims = isContinent ? CONT_BRICK : BRICK, o = dims.w*0.25;
    const studOffsets = [[-o,-o],[o,-o],[-o,o],[o,o]].map(([x,z]) => tmp.set(x,0,z).applyQuaternion(quat).clone());
    const t = { ref, isContinent, n, pos, normal, quat, dims, studOffsets, colors: brickColors(ref, n), brickStart: brickCursor, v:0, from:0, to:0, t0:-1, dur:1, hover:false };
    t.idx = towers.length; brickCursor += n; towers.push(t); ref._tower = t; return t;
  };
  DATA.countries.forEach(c => make(c,false));
  CONTINENTS.forEach(k => make(CONT[k], true));
  // reusable slots for city towers (shown inside a selected country)
  for (let i=0;i<CITY_SLOTS;i++){
    const t = { ref:null, isCity:true, cityOf:null, isContinent:false, n:0, pos:new THREE.Vector3(0,1,0), normal:new THREE.Vector3(0,1,0), quat:new THREE.Quaternion(), dims:CITY_BRICK, studOffsets:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()], colors:[], brickStart:brickCursor, v:0, from:0, to:0, t0:-1, dur:1, hover:false, slot:i };
    t.idx = towers.length; brickCursor += CITY_MAX_BRICKS; towers.push(t); cityTowers.push(t);
  }
  towers.total = brickCursor;
}
/* One 2×2 brick = one instance. Bricks per index point: a country at usage index 100 stacks MAX_BRICKS bricks, so each
   brick stands for 100/MAX_BRICKS index points; the count is Math.round(usageIndex/100*MAX_BRICKS), min 1 when usage > 0. */
const BRICKS_PER_INDEX_POINT = MAX_BRICKS/100;
/* chamfered unit box (x,z in [-0.5,0.5], y in [0,1]): 6 faces, 12 edge bevels, 8 corner triangles = 44 triangles, flat normals */
function chamferBox(c){
  const h = 0.5, e = h - c, pos = [], nor = [];
  const polys = [];   // [outwardNormal, [verts]]
  for (const ax of [0,1,2]) for (const sg of [-1,1]){
    const n = [0,0,0]; n[ax] = sg; const vs = [];
    for (const u of [-e,e]) for (const v of [-e,e]){ const p = [0,0,0]; p[ax] = sg*h; p[(ax+1)%3] = u; p[(ax+2)%3] = v; vs.push(p); }
    polys.push([n, vs]);
  }
  for (let a = 0; a < 3; a++) for (let b = a+1; b < 3; b++){ const f = 3-a-b; for (const sa of [-1,1]) for (const sb of [-1,1]){
    const n = [0,0,0]; n[a] = sa; n[b] = sb; const vs = [];
    for (const [pa, pb] of [[h, e],[e, h]]) for (const t of [-e, e]){ const p = [0,0,0]; p[a] = sa*pa; p[b] = sb*pb; p[f] = t; vs.push(p); }
    polys.push([n, vs]);
  } }
  for (const sx of [-1,1]) for (const sy of [-1,1]) for (const sz of [-1,1]) polys.push([[sx,sy,sz], [[sx*h, sy*e, sz*e],[sx*e, sy*h, sz*e],[sx*e, sy*e, sz*h]]]);
  const N = new THREE.Vector3(), U = new THREE.Vector3(), V = new THREE.Vector3(), C = new THREE.Vector3(), T = new THREE.Vector3();
  for (const [nn, vs] of polys){
    N.set(nn[0], nn[1], nn[2]).normalize();
    C.set(0,0,0); vs.forEach(v => C.add(T.set(v[0], v[1], v[2]))); C.divideScalar(vs.length);
    U.set(1,0,0); if (Math.abs(N.dot(U)) > 0.9) U.set(0,0,1); U.cross(N).normalize(); V.crossVectors(N, U);
    const ordered = vs.map(v => { T.set(v[0], v[1], v[2]).sub(C); return { v, a: Math.atan2(T.dot(V), T.dot(U)) }; }).sort((p, q) => p.a - q.a).map(o => o.v);   // counter-clockwise seen from outside
    for (let i = 1; i < ordered.length-1; i++) for (const v of [ordered[0], ordered[i], ordered[i+1]]){ pos.push(v[0], v[1]+h, v[2]); nor.push(N.x, N.y, N.z); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  const uv = new Float32Array(pos.length/3*2); for (let i = 0; i < pos.length/3; i++){ uv[i*2] = pos[i*3]+0.5; uv[i*2+1] = pos[i*3+1]; } g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}
const brickGeo = chamferBox(0.07);
const studGeo = new THREE.CylinderGeometry(1,1,1,12); studGeo.translate(0,0.5,0);
/* glossy ABS: roughness 0.45, no metalness, faint roughness variation from the shared noise texture (high tier) */
const brickMat = new THREE.MeshStandardMaterial({roughness:0.45, metalness:0, roughnessMap: quality.tier === "high" ? noiseTex : null, flatShading: quality.tier === "low"});
const bricks = new THREE.InstancedMesh(brickGeo, brickMat, towers.total);
const studs = new THREE.InstancedMesh(studGeo, brickMat, towers.total*4);
bricks.frustumCulled = studs.frustumCulled = false;
world.add(bricks, studs);
/* contact discs: a soft dark disc under every tower stands in for a contact shadow (one transparent InstancedMesh, depthWrite off) */
const CONTACT_EXTRA = 40;   // spare instances (arc end caps)
const contactGeo = new THREE.CircleGeometry(1, 20); contactGeo.rotateX(-Math.PI/2);
const contact = new THREE.InstancedMesh(contactGeo, new THREE.MeshBasicMaterial({map:discTex, color:0xffffff, transparent:true, opacity:0.55, depthWrite:false}), towers.length + CONTACT_EXTRA);
contact.frustumCulled = false; contact.renderOrder = 1; world.add(contact);
{ const Z = new THREE.Matrix4().makeScale(0,0,0), black = new THREE.Color(0x000000); for (let i = 0; i < towers.length + CONTACT_EXTRA; i++){ contact.setMatrixAt(i, Z); contact.setColorAt(i, black); } contact.instanceMatrix.needsUpdate = contact.instanceColor.needsUpdate = true; }
/* imperfection, set once from a seeded PRNG (stable across reloads, never animated): per brick a rotation jitter of ±0.6°
   about its own axis, a lateral offset of ±1.5% of the brick width, ±3% lightness and ±2% saturation; per tower a lean of
   up to ~1° that accumulates with height; about one brick in forty sits 4% proud of its slot. */
const JIT_ROT = 0.6*deg, JIT_OFF = 0.015, JIT_L = 0.03, JIT_S = 0.02, LEAN_MAX = 1.0*deg, PROUD_EVERY = 40, PROUD_LIFT = 0.04;
function prng(seed){ let a = (seed*2654435761 + 1013904223) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function seedJitter(t, cap){
  const r = prng(t.brickStart + 1), n = cap;
  t.jitRot = new Float32Array(n); t.jitOff = new Float32Array(n*2); t.jitLift = new Float32Array(n); t.jitHSL = new Float32Array(n*2);
  for (let k = 0; k < n; k++){ t.jitRot[k] = (r()*2-1)*JIT_ROT; t.jitOff[k*2] = (r()*2-1)*JIT_OFF; t.jitOff[k*2+1] = (r()*2-1)*JIT_OFF; t.jitLift[k] = r() < 1/PROUD_EVERY ? PROUD_LIFT : 0; t.jitHSL[k*2] = (r()*2-1)*JIT_L; t.jitHSL[k*2+1] = (r()*2-1)*JIT_S; }
  const a = r()*Math.PI*2; t.leanAxis = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); t.lean = LEAN_MAX*Math.min(1, n/MAX_BRICKS)*(0.4 + 0.6*r());
}
towers.forEach(t => seedJitter(t, t.isCity ? CITY_MAX_BRICKS : t.n));
{ // initial colours + zero matrices (every instance, including the reserved city slots)
  const col = new THREE.Color(), Z = new THREE.Matrix4().makeScale(0,0,0);
  for (let i=0;i<towers.total;i++){ bricks.setMatrixAt(i, Z); bricks.setColorAt(i, col.setHex(0x9a948a)); for (let j=0;j<4;j++){ studs.setMatrixAt(i*4+j, Z); studs.setColorAt(i*4+j, col); } }
  towers.forEach(t => t.colors.forEach((hex,k) => { const i = t.brickStart+k; bricks.setColorAt(i, col.setHex(hex)); bricks.setMatrixAt(i, Z); for (let j=0;j<4;j++){ studs.setColorAt(i*4+j, col); studs.setMatrixAt(i*4+j, Z); } }));
  bricks.instanceColor.needsUpdate = studs.instanceColor.needsUpdate = true;
}
const _M = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _white = new THREE.Color(0xffffff);
const _q = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _ql = new THREE.Quaternion(), _dir = new THREE.Vector3(), _lx = new THREE.Vector3(), _so = new THREE.Vector3(), _Y = new THREE.Vector3(0,1,0);
const easePlastic = t => { const c1 = 1.04, c3 = c1+1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); };   // ease-out with ~4% overshoot that settles
function writeContact(t){
  const vis = t.v > 0.05, r = vis ? t.dims.w*(t.isContinent ? 1.9 : 2.2) : 0;
  _s.set(r, r, r); _p.copy(t.pos).multiplyScalar(1.002); _M.compose(_p, t.quat, _s); contact.setMatrixAt(t.idx, _M);
}
function writeTower(t){
  const {dims} = t, o = dims.w*0.25; let cum = 0;
  _lx.copy(t.leanAxis).applyQuaternion(t.quat);                               // the tower's lean axis in world-local space
  for (let k=0;k<t.n;k++){
    const i = t.brickStart+k, u = clamp(t.v-k, 0, 1), h = u<=0 ? 0 : u>=1 ? 1 : easePlastic(u);
    if (h <= 0.0001){ _s.set(0,0,0); _M.compose(_p.set(0,0,0), t.quat, _s); bricks.setMatrixAt(i,_M); for (let j=0;j<4;j++) studs.setMatrixAt(i*4+j,_M); continue; }
    const bh = dims.h*h;
    _ql.setFromAxisAngle(_lx, t.lean*(k/Math.max(1, t.n-1)));                 // cumulative lean
    _qr.setFromAxisAngle(_Y, t.jitRot[k]); _q.copy(_ql).multiply(t.quat).multiply(_qr);
    _dir.copy(t.normal).applyQuaternion(_ql);
    _p.copy(t.pos).addScaledVector(_dir, cum + t.jitLift[k]*dims.h);
    _so.set(t.jitOff[k*2]*dims.w, 0, t.jitOff[k*2+1]*dims.d).applyQuaternion(t.quat); _p.add(_so);
    _s.set(dims.w, bh, dims.d); _M.compose(_p, _q, _s); bricks.setMatrixAt(i,_M);
    _s.set(dims.stud_r, dims.stud_h*h, dims.stud_r);
    for (let j=0;j<4;j++){ _so.set(j&1 ? o : -o, bh, j&2 ? o : -o).applyQuaternion(_q); _M.compose(_so.add(_p), _q, _s); studs.setMatrixAt(i*4+j,_M); }
    cum += bh;
  }
  writeContact(t);
}
/* focus: when a country is selected, everything else gets a slight black wash. The selected tower keeps its true colours. */
const focus = { set:null, f:0, target:0, applied:undefined };   // f: 0 = nothing dimmed, 1 = others dimmed
const FOCUS_DIM = 0.28;                                          // brightness multiplier for everything outside the focus
function setFocus(list){ focus.set = list && list.length ? new Set(list) : null; focus.target = focus.set ? 1 : 0; }
function paintTower(t){
  const inFocus = !focus.set || focus.set.has(t), mul = inFocus ? 1 : lerp(1, FOCUS_DIM, focus.f);
  const hoverTint = t.hover && !(state.selected && state.selected._tower === t) ? 0.28 : 0;
  for (let k=0;k<t.n;k++){ const i=t.brickStart+k; _c.setHex(t.colors[k]).offsetHSL(0, t.jitHSL[k*2+1], t.jitHSL[k*2]); if (hoverTint) _c.lerp(_white, hoverTint); _c.multiplyScalar(mul); bricks.setColorAt(i,_c); for (let j=0;j<4;j++) studs.setColorAt(i*4+j,_c); }
}
function setTowerTint(t, bright){ t.hover = !!bright; paintTower(t); bricks.instanceColor.needsUpdate = studs.instanceColor.needsUpdate = true; }
function stepFocus(dt){
  if (Math.abs(focus.f - focus.target) < 0.002 && focus.applied === focus.set) return;
  focus.f = lerp(focus.f, focus.target, Math.min(1, dt*7)); if (Math.abs(focus.f - focus.target) < 0.002) focus.f = focus.target;
  focus.applied = focus.set;
  for (const t of towers) paintTower(t);
  bricks.instanceColor.needsUpdate = studs.instanceColor.needsUpdate = true;
  const wash = lerp(1, 0.55, focus.f); landDots.material.color.setScalar(wash);          // land dots and data centres get the same slight wash
  focus.dcMul = lerp(1, 0.6, focus.f); dcMesh.material.color.setScalar(focus.dcMul);
}
function animateTower(t, target, dur, delay, now){ t.from = t.v; t.to = target; t.t0 = now + (delay||0); t.dur = dur; }
function stepTowers(now){
  let dirty = false;
  for (const t of towers){
    if (t.t0 < 0) continue;
    const p = clamp((now - t.t0)/t.dur, 0, 1);
    if (p <= 0) continue;
    t.v = lerp(t.from, t.to, easeInOutCubic(p)); writeTower(t); dirty = true;
    const nb = Math.floor(t.v); if (nb !== t.nb){ sfx.brick(nb, nb > (t.nb||0)); t.nb = nb; }
    if (p >= 1) t.t0 = -1;
  }
  if (dirty){ bricks.instanceMatrix.needsUpdate = true; studs.instanceMatrix.needsUpdate = true; contact.instanceMatrix.needsUpdate = true; }
}

/* which data centres most plausibly serve each country: in-country sites, the nearest foreign site, and Northern Virginia
   (where most frontier-model inference still runs). Illustrative, like everything else here. */
{
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  DATA.datacentres.forEach(d => d.serves = []);
  DATA.countries.forEach(c => {
    latLonToVec(c.lat, c.lon, 1, _v);
    const local = DATA.datacentres.filter(d => d.iso === c.iso).slice(0,3);
    const foreign = DATA.datacentres.filter(d => d.iso !== c.iso).map(d => [d, _v.dot(_w.copy(d._pos).normalize())]).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]);
    const set = [...local, ...foreign];
    const va = DATA.datacentres.find(d => d.name === "us-east-1"); if (va && !set.includes(va) && c.iso !== "US") set.push(va);
    c.servedBy = set; set.forEach(d => d.serves.push(c));
  });
}
/* arcs: solid plastic tubes in the operator colour (js/arcs.js). Spare contact-disc instances become the end caps. */
const arcsCtl = createArcs({ world, contact, contactBase: towers.length, contactSpare: CONTACT_EXTRA, isPhone: () => isNarrow(), lowTier: () => quality.tier === "low" });
function clearArcs(){ arcsCtl.clear(); }
function showArcs(pairs){ arcsCtl.show(pairs); }   // pairs: [{from:Vector3, to:Vector3, color, dc}]
function stepArcs(now){ arcsCtl.step(now); }
const arcCount = () => arcsCtl.count;

function targetBricks(t){
  if (t.isCity) return (state.mode === "countries" && t.cityOf && state.selected === t.cityOf) ? t.n * t.cityOf.growthCurve[state.year] : 0;
  const on = (state.mode==="continents") === t.isContinent; return on ? t.n * t.ref.growthCurve[state.year] : 0;
}
/* city towers: thin towers at a country's main cities, same height scale as country towers */
const _cup = new THREE.Vector3(0,1,0), _ctmp = new THREE.Vector3(), _Z = new THREE.Matrix4().makeScale(0,0,0);
function clearCitySlot(t){
  t.v = 0; t.to = 0; t.t0 = -1; t.nb = 0;
  for (let k=0;k<CITY_MAX_BRICKS;k++){ const i = t.brickStart+k; bricks.setMatrixAt(i,_Z); for (let j=0;j<4;j++) studs.setMatrixAt(i*4+j,_Z); }
  contact.setMatrixAt(t.idx, _Z);
  bricks.instanceMatrix.needsUpdate = studs.instanceMatrix.needsUpdate = contact.instanceMatrix.needsUpdate = true;
}
function cityObjects(c){
  if (c._cityObjs) return c._cityObjs;
  const perCap = c.activeUsers / c.population;
  c._cityObjs = (c.cities||[]).map(([name,lat,lon,pop,rel]) => ({ name, lat, lon, population:pop, rel, isCity:true, country:c, continent:c.continent,
    usageIndex: Math.round(c.usageIndex*rel*10)/10, activeUsers: pop*perCap*rel, providerShare:c.providerShare })).sort((a,b)=>b.usageIndex-a.usageIndex);
  return c._cityObjs;
}
function showCities(c){
  const now = performance.now(), list = c ? cityObjects(c).slice(0, CITY_SLOTS) : [];
  cityTowers.forEach((t,i) => {
    clearCitySlot(t);
    const city = list[i]; t.ref = city || null; t.cityOf = c || null;
    if (!city){ t.n = 0; return; }
    t.n = Math.max(1, Math.round(Math.min(120, city.usageIndex)/100*MAX_BRICKS));
    latLonToVec(city.lat, city.lon, R, t.pos); t.normal.copy(t.pos).normalize(); t.quat.setFromUnitVectors(_cup, t.normal);
    const o = CITY_BRICK.w*0.25; [[-o,-o],[o,-o],[-o,o],[o,o]].forEach(([x,z],j) => t.studOffsets[j].copy(_ctmp.set(x,0,z).applyQuaternion(t.quat)));
    t.colors = brickColors(c, t.n); city._tower = t;
    t.colors.forEach((hex,k) => { const idx = t.brickStart+k; bricks.setColorAt(idx, _c.setHex(hex)); for (let j=0;j<4;j++) studs.setColorAt(idx*4+j, _c); });
    animateTower(t, t.n * c.growthCurve[state.year], 700, 350 + i*90, now);
  });
  bricks.instanceColor.needsUpdate = studs.instanceColor.needsUpdate = true;
}
function retarget(dur, stagger){
  const now = performance.now();
  towers.forEach((t,i) => { const tgt = targetBricks(t); if (Math.abs(tgt - t.v) > 1e-3) animateTower(t, tgt, dur, stagger ? (i%13)*35 : 0, now); });
}

/* selection ring */
const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.08, 48), new THREE.MeshBasicMaterial({color:0xece7dc, transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false}));
ring.geometry.rotateX(-Math.PI/2); ring.visible = false; world.add(ring);
function placeRingAt(pos, quat, r){ ring.visible = true; ring.position.copy(pos).multiplyScalar(1.003); ring.quaternion.copy(quat); ring.scale.set(r,r,r); ring.userData.base = r; ring.userData.t0 = performance.now(); }
function placeRing(t){
  if (!t){ ring.visible = false; return; }
  ring.visible = true; ring.position.copy(t.pos).multiplyScalar(1.003); ring.quaternion.copy(t.quat);
  const r = t.dims.w*1.35; ring.scale.set(r, r, r); ring.userData.base = r; ring.userData.t0 = performance.now();
}


/* =====================================================================================
   CAMERA / ORBIT  (own implementation: yaw/pitch on the world group, dolly on the camera)
   ===================================================================================== */
const _qy = new THREE.Quaternion(), _qx = new THREE.Quaternion(), _ax = new THREE.Vector3(1,0,0), _ay = new THREE.Vector3(0,1,0);
function applyView(){
  _qy.setFromAxisAngle(_ay, view.yaw); _qx.setFromAxisAngle(_ax, view.pitch);
  world.quaternion.copy(_qx).multiply(_qy);
  camera.position.set(view.panX, view.panY, view.dist); camera.lookAt(view.panX, view.panY, 0);   // pan = slide camera parallel to the screen
}
function worldPerPx(){ return 2*view.dist*Math.tan(camera.fov*deg/2)/VH; }
function panBy(dxPx, dyPx){ view.autoPan = false; const w = worldPerPx(), lim = 0.9*view.dist; view.tPanX = clamp(view.tPanX - dxPx*w, -lim, lim); view.tPanY = clamp(view.tPanY + dyPx*w, -lim, lim); }
// screen point the camera looks straight at (the main area's centre: the viewport minus the side panel, or above the open sheet)
function viewCentre(){ const v = camera.view; return v && v.enabled ? [VX + VW/2 - v.offsetX, VY + VH/2 - v.offsetY] : [VX + VW/2, VY + VH/2]; }
// dolly by `factor` keeping whatever is under screen point (px,py) in place: the pan needed is o·(d0−d1)/F for a point o px off centre, whatever its depth
function zoomAt(factor, px, py){
  const d0 = view.tDist, d1 = clamp(d0*factor, view.minDist, view.maxDist); if (d1 === d0) return;
  const [cx, cy] = viewCentre(), F = (VH/2)/Math.tan(camera.fov*deg/2), lim = 0.9*d1;
  view.autoPan = false; view.tDist = d1;
  view.tPanX = clamp(view.tPanX + (px-cx)*(d0-d1)/F, -lim, lim); view.tPanY = clamp(view.tPanY - (py-cy)*(d0-d1)/F, -lim, lim);
}
const isNarrow = () => window.matchMedia("(max-width:900px) and (orientation:portrait), (max-width:600px)").matches;   // phones: bottom sheet layout
function panelWidth(){
  if (isNarrow()) return 0;
  if (document.body.classList.contains("pcol")) return 60+48;
  const w = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--panel-w")) || 420;
  return w + 48;
}
let wasNarrow = isNarrow();
let VW = window.innerWidth, VH = window.innerHeight, VX = 0, VY = 0;   // the canvas's on-screen box: size and offset in CSS px (page zoom on iOS can make this differ from the window)
function measureCanvas(){ const r = canvas.getBoundingClientRect(); if (r.width > 0 && r.height > 0){ VW = r.width; VH = r.height; VX = r.left; VY = r.top; } else { VW = window.innerWidth; VH = window.innerHeight; VX = VY = 0; } }
function resize(){
  measureCanvas();
  const W = VW, H = VH;
  const nowNarrow = isNarrow();
  if (nowNarrow && !wasNarrow) $("#panel").classList.add("strip");
  if (!nowNarrow && wasNarrow) $("#panel").classList.remove("strip");
  wasNarrow = nowNarrow;
  const pw = panelWidth();
  renderer.setSize(W, H, false);
  camera.aspect = W/H; camera.updateProjectionMatrix();
  arcsCtl.setResolution(W, H);
  // centre the globe in the main area: the viewport minus the side panel; on phones with the sheet open, the area above the sheet
  const sheetOpen = nowNarrow && !$("#panel").classList.contains("strip");
  const sheetH = sheetOpen ? Math.min(H*0.8, $("#panel").offsetHeight + 10) : 0;   // centre the globe in the strip of screen above the open sheet
  camera.setViewOffset(W, H, pw/2, sheetH/2, W, H);
  const aspect = Math.max(0.3, (W-pw)/H), fitDist = (nowNarrow ? 1.3 : 1.42)/(Math.tan(camera.fov*deg/2)*Math.min(1, aspect));
  const wasMax = Math.abs(view.tDist - view.maxDist) < 1e-3;
  view.maxDist = Math.max(2.4, fitDist);
  if (wasMax || view.tDist > view.maxDist) view.tDist = view.maxDist;
  if (!state.built) view.dist = view.tDist;
}
const FLY_TILT = 45*deg;   // viewing angle off the tower's axis: side-on enough to read the bricks
const FLY_FOCUS = 0.5;      // the tower's midpoint sits at the exact centre of the main area
function fitDistFor(L){ return clamp(1 + 2.4*Math.max(L, 0.08), view.minDist, view.maxDist); }   // zoom so the whole tower spans about half the viewport height
const _fq = new THREE.Quaternion(), _fqy = new THREE.Quaternion(), _fqx = new THREE.Quaternion(), _fb = new THREE.Vector3(), _fn = new THREE.Vector3();
function flyTo(ref, dist, towerLen){
  const ty = -ref.lon*deg; let dy = ty - view.tYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  view.tYaw = view.tYaw + dy; view.tPitch = clamp(ref.lat*deg - FLY_TILT, -80*deg, 80*deg);   // view from slightly south so the tower stands tip-up
  if (dist) view.tDist = clamp(dist, view.minDist, view.maxDist); else view.tDist = Math.min(view.tDist, lerp(view.minDist, view.maxDist, 0.42));
  // where will the tower's base be once the rotation lands? pan the camera so that point is dead centre
  _fqy.setFromAxisAngle(_ay, view.tYaw); _fqx.setFromAxisAngle(_ax, view.tPitch); _fq.copy(_fqx).multiply(_fqy);
  latLonToVec(ref.lat, ref.lon, R, _fb); _fn.copy(_fb).normalize(); _fb.addScaledVector(_fn, (towerLen||0)*FLY_FOCUS).applyQuaternion(_fq);
  view.tPanX = _fb.x; view.tPanY = _fb.y; view.autoPan = true;
  view.flying = true; view.yawVel = view.pitchVel = 0; view.lastInteract = performance.now();
}
function pxPerRadian(){ return (VH/2)/(Math.tan(camera.fov*deg/2)*Math.max(0.4, view.dist-1)); }

/* =====================================================================================
   HIT TESTING: exact ray casts against the bricks that are actually drawn.
   A ray is cast from the camera through the pointer and tested against every brick
   (towers and data centres) as the true 3D box it is rendered as; the globe occludes,
   so nothing behind the horizon can be picked, and where bricks overlap on screen the
   one nearest the camera (the one you see) wins. For tolerance, a small ring of
   samples around the pointer is tried when the pointer itself hits nothing.
   ===================================================================================== */
const _cam = new THREE.Vector3();
function toScreen(v){ v.project(camera); v.x = VX + (v.x+1)/2*VW; v.y = VY + (1-v.y)/2*VH; return v; }   // world → client (page) pixels
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _rl = new THREE.Ray(), _qInv = new THREE.Quaternion();
const _hb = new THREE.Vector3(), _ht = new THREE.Vector3(), _hp = new THREE.Vector3(), _hm = new THREE.Matrix4(), _hi = new THREE.Matrix4();
const _box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5)), _bray = new THREE.Ray();
const _sphere = new THREE.Sphere(new THREE.Vector3(0,0,0), R);
// distance along the world-local ray to the front face of a brick (instance i of mesh), or Infinity if the ray misses it
function brickHitDist(mesh, i, topExtra){
  mesh.getMatrixAt(i, _hm);
  if (Math.abs(_hm.determinant()) < 1e-18) return Infinity;            // collapsed (not yet built) brick
  _hi.copy(_hm).invert();
  _bray.copy(_rl).applyMatrix4(_hi);                                    // ray in the brick's own unit-box space
  _box.max.y = 1 + (topExtra||0);                                       // the top brick includes its studs
  if (!_bray.intersectBox(_box, _hp)) return Infinity;
  _hp.applyMatrix4(_hm);                                                // back to world-local, then measure along the real ray
  return _hp.distanceTo(_rl.origin);
}
// cast one ray through screen point (px,py); returns the nearest visible brick as a hit object, or null
function castAt(px, py){
  _ndc.set((px-VX)/VW*2-1, -((py-VY)/VH*2-1));   // client (page) pixels → the canvas's own normalised coordinates
  _ray.setFromCamera(_ndc, camera);
  // the world group only rotates, so the ray is moved into its frame once and every brick is tested where it was placed
  _qInv.copy(world.quaternion).invert();
  _rl.origin.copy(_ray.ray.origin).applyQuaternion(_qInv); _rl.direction.copy(_ray.ray.direction).applyQuaternion(_qInv);
  // the globe itself: anything further along the ray than its surface is behind the horizon
  const limit = _rl.intersectSphere(_sphere, _hp) ? _hp.distanceTo(_rl.origin) : Infinity;
  let best = null, bestD = limit;
  for (const t of towers){
    if (t.v < 0.05) continue;
    const len = Math.min(t.v, t.n)*t.dims.h;
    _hb.copy(t.pos); _ht.copy(t.pos).addScaledVector(t.normal, len + t.dims.stud_h);
    const reach = t.dims.w*0.75;                                        // broad phase: half the box diagonal, with a little slack
    if (_rl.distanceSqToSegment(_hb, _ht) > reach*reach) continue;
    const top = Math.min(t.n, Math.ceil(t.v)) - 1;
    for (let k=0;k<=top;k++){
      const d = brickHitDist(bricks, t.brickStart+k, k===top ? t.dims.stud_h/t.dims.h : 0);
      if (d < bestD){ bestD = d; best = {type:"tower", t}; }
    }
  }
  for (let i=0;i<DATA.datacentres.length;i++){
    const dc = DATA.datacentres[i];
    _hb.copy(dc._pos); _ht.copy(dc._pos).addScaledVector(_hp.copy(dc._pos).normalize(), DC_BRICK.h);
    const reach = DC_BRICK.w*0.75;
    if (_rl.distanceSqToSegment(_hb, _ht) > reach*reach) continue;
    const d = brickHitDist(dcMesh, i, 0);
    if (d < bestD){ bestD = d; best = {type:"dc", d:dc}; }
  }
  return best;
}
const RING = Array.from({length:8}, (_,i) => [Math.cos(i*Math.PI/4), Math.sin(i*Math.PI/4)]);
const _sa = new THREE.Vector3(), _sb = new THREE.Vector3();
function screenDistTo(hit, px, py){   // on-screen distance from the pointer to the hit object's axis (tower) or brick (data centre)
  if (hit.type === "dc"){ toScreen(_sa.copy(hit.d._pos).applyQuaternion(world.quaternion)); return Math.hypot(_sa.x-px, _sa.y-py); }
  const t = hit.t, len = Math.min(t.v, t.n)*t.dims.h;
  _sa.copy(t.pos).applyQuaternion(world.quaternion); _sb.copy(t.pos).addScaledVector(t.normal, len).applyQuaternion(world.quaternion);
  toScreen(_sa); toScreen(_sb);
  const vx = _sb.x-_sa.x, vy = _sb.y-_sa.y, l2 = vx*vx+vy*vy, u = l2 > 0 ? clamp(((px-_sa.x)*vx + (py-_sa.y)*vy)/l2, 0, 1) : 0;
  return Math.hypot(px - (_sa.x + u*vx), py - (_sa.y + u*vy));
}
function hitTest(px, py){
  camera.getWorldPosition(_cam);
  const hit = castAt(px, py);
  if (hit) return hit;   // something is drawn exactly under the pointer: that always wins
  // nothing exactly under the pointer: allow a small margin (bigger for fingers) by sampling a ring around it, nearest ring first.
  // Several towers can sit inside one ring when the globe is zoomed out, so every sample on a ring is tried and the object whose
  // drawn axis is closest to the pointer wins, rather than whichever sample happened to be tested first.
  const radii = lastPointerType === "touch" ? [2, 7, 13, 20, 28] : [1.5, 4, 8];
  for (const r of radii){
    let best = null, bestD = Infinity;
    for (const [cx, cy] of RING){
      const h = castAt(px + cx*r, py + cy*r); if (!h) continue;
      const d = screenDistTo(h, px, py); if (d < bestD){ bestD = d; best = h; }
    }
    if (best) return best;
  }
  return null;
}


/* =====================================================================================
   POINTER / KEYBOARD INTERACTION
   ===================================================================================== */
const tip = $("#tip");
let lastPointerType = COARSE ? "touch" : "mouse";
const pointers = new Map(); let dragging = false, downX=0, downY=0, lastX=0, lastY=0, lastT=0, pinchD=0, mouseX=-1, mouseY=-1, mouseMoved=false;
function touchUI(){ view.lastInteract = performance.now(); view.flying = false; }
let panMode = false, pinchMX = 0, pinchMY = 0, tapBlocked = false, lastTapT = 0, lastTapX = 0, lastTapY = 0, lastTapHit = false, tipUntil = 0, selectedAt = -1e9;
function markSelected(){ selectedAt = performance.now(); }   // called by the panel when a tower or data centre becomes the selection
canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("pointerdown", e => {
  lastPointerType = e.pointerType || "mouse";
  try { canvas.setPointerCapture(e.pointerId); } catch(_){}
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pointers.size === 1){ dragging = true; tapBlocked = false; panMode = e.button === 2 || e.button === 1 || e.shiftKey; downX = lastX = e.clientX; downY = lastY = e.clientY; lastT = performance.now(); view.yawVel = view.pitchVel = 0; canvas.classList.add("dragging"); }
  else if (pointers.size === 2){ const [a,b] = [...pointers.values()]; pinchD = Math.hypot(a.x-b.x, a.y-b.y); pinchMX = (a.x+b.x)/2; pinchMY = (a.y+b.y)/2; tapBlocked = true; view.yawVel = view.pitchVel = 0; }
  touchUI();
});
canvas.addEventListener("pointermove", e => {
  mouseX = e.clientX; mouseY = e.clientY; mouseMoved = true;
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pointers.size === 2){
    const [a,b] = [...pointers.values()], d = Math.hypot(a.x-b.x, a.y-b.y), mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
    if (pinchD > 0){ zoomAt(pinchD/d, mx, my); panBy(mx-pinchMX, my-pinchMY); }   // pinch = zoom about the fingers, two-finger drag = move
    pinchD = d; pinchMX = mx; pinchMY = my; touchUI(); return;
  }
  if (!dragging) return;
  const dx = e.clientX-lastX, dy = e.clientY-lastY, now = performance.now(), dt = Math.max(8, now-lastT);
  if (panMode){ panBy(dx, dy); }
  else {
    const k = 1/pxPerRadian();
    view.tYaw += dx*k; view.tPitch = clamp(view.tPitch + dy*k, -80*deg, 80*deg);
    view.yawVel = dx*k/dt*16; view.pitchVel = dy*k/dt*16;
  }
  lastX = e.clientX; lastY = e.clientY; lastT = now; touchUI();
});
function endPointer(e){
  const slop = lastPointerType === "touch" ? 12 : 6;   // a finger wobbles a few pixels during a tap
  const wasDrag = tapBlocked || (dragging && Math.hypot(e.clientX-downX, e.clientY-downY) > slop);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchD = 0;
  if (pointers.size === 1){   // one finger lifted after a pinch: the remaining finger continues as a plain drag from where it is, with no jump
    const [r] = [...pointers.values()]; lastX = r.x; lastY = r.y; lastT = performance.now(); dragging = true; panMode = false; view.yawVel = view.pitchVel = 0;
  }
  if (pointers.size === 0){
    dragging = false; canvas.classList.remove("dragging");
    if (performance.now()-lastT > 80) view.yawVel = view.pitchVel = 0;
    if (!wasDrag && e.type === "pointerup"){
      const now = performance.now();
      const near = now - lastTapT < 450 && Math.hypot(e.clientX-lastTapX, e.clientY-lastTapY) < 40;
      if (lastPointerType === "touch" && near && lastTapHit){ touchUI(); return; }   // second tap of a double tap on a tower: the globe is already flying there, so the spot under the finger is now something else
      if (lastPointerType === "touch" && now - selectedAt < 700){ touchUI(); return; }   // likewise any tap while the globe is still flying to a fresh selection
      // a finger rolls a few pixels as it lifts; what the person aimed at is where it first landed, so taps are resolved at the touch-down point
      const hx = lastPointerType === "touch" ? downX : e.clientX, hy = lastPointerType === "touch" ? downY : e.clientY;
      const hit = hitTest(hx, hy);
      const dbl = lastPointerType === "touch" && near && !lastTapHit;
      lastTapT = now; lastTapX = e.clientX; lastTapY = e.clientY; lastTapHit = !!hit;
      if (hit && lastPointerType === "touch"){ state.hoverHit = hit; tipUntil = now + 1800; showTip(hit); }   // name the tapped tower for a moment
      if (hit && hit.type === "tower" && hit.t.isCity){ const c = hit.t.cityOf; focusCity(c, cityObjects(c).indexOf(hit.t.ref)); }
      else if (hit && hit.type === "tower") select(hit.t.ref);
      else if (hit && hit.type === "dc") selectDC(hit.d);
      else if (eggs.hit(hx, hy)) {}
      else if (dbl){ zoomAt(0.6, hx, hy); lastTapT = 0; }   // double tap on empty globe: zoom in there
      else {
        if (state.selected || state.selectedDC) select(null);
        if (isNarrow() && !$("#panel").classList.contains("strip") && !$("#panel").classList.contains("kb")){ $("#panel").classList.add("strip"); syncSheet(); }   // phones: tapping the globe tucks the sheet away
      }
    }
  }
  touchUI();
}
canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", () => { mouseX = mouseY = -1; setHover(null); });
canvas.addEventListener("wheel", e => { e.preventDefault(); if (e.ctrlKey) zoomAt(Math.exp(clamp(e.deltaY, -60, 60)*0.01), e.clientX, e.clientY); else zoomAt(Math.exp(clamp(e.deltaY, -60, 60)*0.0025), e.clientX, e.clientY); touchUI(); }, {passive:false});   // scroll (or trackpad pinch) zooms towards the cursor
window.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") return;
  const step = 6*deg, ps = 40;
  if (e.key === "Escape"){ select(null); }
  else if (e.key === "/"){ searchEl.focus(); searchEl.select(); }
  else if (e.key === "t" || e.key === "T"){ toggleTicker(); }
  else if (e.key === "u" || e.key === "U"){ eggs.launch(); }
  else if (e.key === "p" || e.key === "P"){ setLayer(state.layer === "power" ? "none" : "power"); }
  else if (e.key === "d" || e.key === "D"){ setLayer(state.layer === "data" || state.layer === "dataShare" ? "none" : "data"); }
  else if (e.key === "s" || e.key === "S"){ sfx.set(!sfx.on); if (sfx.on) sfx.pin(); }
  else if (e.shiftKey && e.key.startsWith("Arrow")){ panBy(e.key==="ArrowLeft"?-ps:e.key==="ArrowRight"?ps:0, e.key==="ArrowUp"?-ps:e.key==="ArrowDown"?ps:0); touchUI(); }
  else if (e.key === "ArrowLeft"){ view.tYaw -= step; touchUI(); }
  else if (e.key === "ArrowRight"){ view.tYaw += step; touchUI(); }
  else if (e.key === "ArrowUp"){ view.tPitch = clamp(view.tPitch - step, -80*deg, 80*deg); touchUI(); }
  else if (e.key === "ArrowDown"){ view.tPitch = clamp(view.tPitch + step, -80*deg, 80*deg); touchUI(); }
  else return;
  e.preventDefault();
});
const _tipV = new THREE.Vector3();
function tipAnchor(hit){   // screen position of the top of the hovered tower, or the data-centre brick
  if (hit.type === "tower"){ const t = hit.t; _tipV.copy(t.pos).addScaledVector(t.normal, Math.min(t.v, t.n)*t.dims.h).applyQuaternion(world.quaternion); }
  else _tipV.copy(hit.d._pos).applyQuaternion(world.quaternion);
  toScreen(_tipV); return _tipV;
}
let tipKey = null;
const _hzP = new THREE.Vector3(), _hzN = new THREE.Vector3(), _hzC = new THREE.Vector3();
function overHorizon(t){   // the tower's base is on the far side of the globe: only its top is showing above the limb
  _hzP.copy(t.pos).applyQuaternion(world.quaternion); _hzN.copy(t.normal).applyQuaternion(world.quaternion); camera.getWorldPosition(_hzC);
  return _hzN.dot(_hzC.sub(_hzP)) <= 0;
}
function showTip(hit, x, y){
  if (!hit){ tip.style.opacity = 0; tipKey = null; return; }
  const hz = hit.type === "tower" && overHorizon(hit.t);
  const key = hit.type === "tower" ? "t:" + (hit.t.ref.isCity ? hit.t.ref.country.iso + "/" : "") + hit.t.ref.name + (hz ? "/hz" : "") : "d:" + hit.d.name;
  if (key !== tipKey){
    tipKey = key;
    if (hit.type === "tower"){
      const r = hit.t.ref;
      if (r.isCity) tip.innerHTML = `<b>${r.name}</b><span>${r.country.name} · usage index <em>${Math.round(r.usageIndex)}</em> · <em>${r.rel.toFixed(1)}×</em> national average · ≈<em>${fmtM(r.activeUsers)}</em> users</span>`;
      else tip.innerHTML = `<b>${r.name}</b><span>usage index <em>${r.usageIndex.toFixed(r.isContinent?1:0)}</em> · active users <em>${fmtM(r.activeUsers)}</em>${r.isContinent?` · ${r.countries} countries shown`:""}</span>${hz ? `<span class="hz">Top of the tower, showing over the horizon</span>` : ""}${lastPointerType === "touch" ? "" : `<span class="cta">click for the full story</span>`}`;
    } else {
      tip.innerHTML = `<b>${hit.d.name}</b><span>${OPERATOR_LABEL[hit.d.operator]} data centre · ${hit.d.city}</span>${lastPointerType === "touch" ? "" : `<span class="cta">click for details</span>`}`;
    }
  }
  const a = tipAnchor(hit);   // the label follows the object, not the cursor, so it stays correct while the globe moves
  tip.style.transform = `translate(${Math.round(a.x)}px, ${Math.round(a.y)}px) translate(-50%, calc(-100% - 14px))`;
  tip.style.opacity = 1;
}
function setHover(hit){
  const t = hit && hit.type==="tower" ? hit.t : null;
  if (state.hovered !== t){
    if (state.hovered) setTowerTint(state.hovered, false);
    state.hovered = t;
    if (t){ setTowerTint(t, true); sfx.hover(); }
  }
  state.hoverHit = hit || null;
  arcsCtl.highlight(hit && hit.type === "dc" ? hit.d : null);
  canvas.classList.toggle("pointing", !!hit);
  if (hit){ showTip(hit, mouseX, mouseY); view.lastInteract = performance.now(); }   // hovering pauses the auto-rotate so the target stays put
  else showTip(null);
}

/* per-frame hover: re-tested every frame (not just on mouse move) so it stays accurate while the globe turns or flies */
function stepHover(now){
  if (!dragging && pointers.size === 0 && mouseX >= 0 && lastPointerType !== "touch"){ mouseMoved = false; setHover(hitTest(mouseX, mouseY)); }
  else if (dragging && state.hovered){ setHover(null); }
  if (tipUntil){ if (now < tipUntil && state.hoverHit && !dragging) showTip(state.hoverHit); else { tipUntil = 0; state.hoverHit = null; showTip(null); } }   // touch: the name follows the tower while it flies to centre
}


/* controls: continents toggle, time slider, reset */
function setMode(mode){
  if (state.mode === mode) return;
  sfx.toggle();
  state.mode = mode; select(null);
  $("#contToggle").classList.toggle("on", mode==="continents"); $("#contToggle").setAttribute("aria-pressed", mode==="continents");
  setHover(null); retarget(900, true);
}
$("#contToggle").addEventListener("click", () => setMode(state.mode === "continents" ? "countries" : "continents"));
document.querySelectorAll("#layerSeg button").forEach(b => b.addEventListener("click", () => setLayer(b.dataset.layer === "data" && state.layer === "dataShare" ? "dataShare" : b.dataset.layer)));
$("#soundToggle").addEventListener("click", () => { sfx.set(!sfx.on); if (sfx.on) sfx.pin(); });
/* the year slider was removed; the data still carries growthCurve, and state.year stays at 4 (today) */
function resetView(){ select(null); view.tPanX = view.tPanY = 0; view.autoPan = false; view.tDist = view.maxDist; view.tPitch = 12*deg; let d = 58*deg - view.tYaw; d = Math.atan2(Math.sin(d),Math.cos(d)); view.tYaw += d; view.flying = true; view.lastInteract = performance.now(); }

/* =====================================================================================
   EASTER EGGS: tiny Lego craft that drift past every few minutes. Subtle by design.
   Press U to summon one; click one to make it zip away.
   ===================================================================================== */
const eggs = (() => {
  const group = new THREE.Group(); scene.add(group);
  const M = (hex, o={}) => new THREE.MeshStandardMaterial(Object.assign({color:hex, roughness:0.45, metalness:0.05}, o));
  const box = (w,h,d,mat,x=0,y=0,z=0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat); m.position.set(x,y,z); return m; };
  const cyl = (rt,rb,h,mat,x=0,y=0,z=0,seg=20) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat); m.position.set(x,y,z); return m; };
  const sph = (r,mat,x=0,y=0,z=0,seg=16) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r,seg,seg), mat); m.position.set(x,y,z); return m; };
  const stud = (mat,x,y,z,r=0.08) => cyl(r,r,0.08,mat,x,y+0.04,z,12);
  const GREY = M(0xd0d3d8), DARK = M(0x5a5f6b), GREEN = M(0x6fd35a), BLACK = M(0x111214), RED = M(0xe0453a), WHITE = M(0xf3f3ee), BLUE = M(0x2a4bd7), GOLD = M(0xd4a24c);
  const GLASS = M(0x7de3d1, {transparent:true, opacity:0.55, roughness:0.2});
  const LIGHT = () => M(0xffd166, {emissive:0xffd166, emissiveIntensity:1.2});
  const FLAME = M(0xff8c3a, {emissive:0xff6a00, emissiveIntensity:1.6, transparent:true, opacity:0.9});
  function alienHead(r, x, y, z){ const g = new THREE.Group(); g.add(sph(r, GREEN)); g.add(sph(r*0.22, BLACK, -r*0.35, r*0.15, r*0.85)); g.add(sph(r*0.22, BLACK, r*0.35, r*0.15, r*0.85)); g.add(cyl(0.03,0.03,r*0.8,DARK,0,r*1.3,0,8)); g.add(stud(GREEN,0,r*1.7,0,0.06)); g.position.set(x,y,z); return g; }
  function saucer(){
    const g = new THREE.Group();
    g.add(cyl(1.0,1.35,0.32,GREY,0,0,0,28)); g.add(cyl(0.9,0.55,0.28,DARK,0,-0.3,0,28));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55,24,12,0,Math.PI*2,0,Math.PI/2), GLASS); dome.position.y = 0.16; g.add(dome);
    g.add(alienHead(0.24,0,0.34,0));
    for (let i=0;i<4;i++){ const a = i*Math.PI/2 + Math.PI/4; g.add(stud(GREY, Math.cos(a)*0.82, 0.16, Math.sin(a)*0.82)); }
    g.userData.lights = [];
    for (let i=0;i<8;i++){ const a = i*Math.PI/4, l = sph(0.07, LIGHT(), Math.cos(a)*1.15, -0.12, Math.sin(a)*1.15, 8); g.add(l); g.userData.lights.push(l); }
    g.userData.kind = "saucer"; g.scale.setScalar(0.06); return g;
  }
  function rocket(){
    const g = new THREE.Group();
    g.add(cyl(0.34,0.34,1.5,WHITE,0,0,0)); g.add(cyl(0.35,0.35,0.22,RED,0,0.45,0)); g.add(cyl(0.35,0.35,0.22,RED,0,-0.45,0));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.35,0.6,20), RED); nose.position.y = 1.05; g.add(nose); g.add(stud(RED,0,1.35,0,0.07));
    const win = cyl(0.12,0.12,0.06,BLUE,0,0.15,0.33,12); win.rotation.x = Math.PI/2; g.add(win);
    for (let i=0;i<3;i++){ const a = i*2*Math.PI/3; const f = box(0.08,0.5,0.4,RED); f.position.set(Math.cos(a)*0.42,-0.7,Math.sin(a)*0.42); f.rotation.y = -a; g.add(f); }
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.26,0.7,14), FLAME); fl.rotation.x = Math.PI; fl.position.y = -1.1; g.add(fl); g.userData.flame = fl;
    g.userData.kind = "rocket"; g.scale.setScalar(0.055); return g;
  }
  function alienPod(){
    const g = new THREE.Group();
    g.add(cyl(0.5,0.35,0.5,DARK,0,-0.25,0,20)); g.add(alienHead(0.42,0,0.25,0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55,0.05,10,28), M(0x7de3d1,{emissive:0x2dd4bf, emissiveIntensity:0.9})); ring.rotation.x = Math.PI/2; ring.position.y = -0.6; g.add(ring); g.userData.ring = ring;
    g.userData.kind = "alien"; g.scale.setScalar(0.05); return g;
  }
  function satellite(){
    const g = new THREE.Group();
    g.add(box(0.6,0.6,0.6,GOLD)); g.add(stud(GOLD,-0.15,0.3,-0.15)); g.add(stud(GOLD,0.15,0.3,-0.15)); g.add(stud(GOLD,-0.15,0.3,0.15)); g.add(stud(GOLD,0.15,0.3,0.15));
    g.add(box(1.5,0.04,0.55,BLUE,-1.1,0,0)); g.add(box(1.5,0.04,0.55,BLUE,1.1,0,0)); g.add(box(0.7,0.06,0.08,GREY,-0.65,0,0)); g.add(box(0.7,0.06,0.08,GREY,0.65,0,0));
    g.add(cyl(0.4,0.12,0.2,GREY,0,0.55,0,20)); g.add(cyl(0.02,0.02,0.4,GREY,0,0.75,0,6));
    g.userData.kind = "satellite"; g.scale.setScalar(0.05); return g;
  }
  const ships = [saucer(), rocket(), alienPod(), satellite()];
  ships.forEach(sh => { sh.visible = false; group.add(sh); });
  let active = null, t0 = 0, dur = 0, phase = 0, nextAt = performance.now() + 45000 + Math.random()*75000;   // first visit after 45–120 s
  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), P2 = new THREE.Vector3(), tmp = new THREE.Vector3(), prev = new THREE.Vector3(), UP = new THREE.Vector3(0,1,0);
  function launch(kind){
    if (active) active.visible = false;
    active = kind != null ? ships[kind] : ships[Math.floor(Math.random()*ships.length)];
    const depth = Math.random() < 0.65 ? -1.7 : 0.7;                            // mostly behind the globe, sometimes in front near the edges
    const hh = Math.tan(camera.fov*deg/2)*(view.dist - depth), hw = hh*Math.max(1, (VW-panelWidth())/VH);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const yA = depth > 0 ? (Math.random() < 0.5 ? 1 : -1)*hh*0.85 : (Math.random()*1.4-0.7)*hh;
    const yB = depth > 0 ? yA + (Math.random()*0.3-0.15)*hh : (Math.random()*1.4-0.7)*hh;
    P0.set(-dir*hw*1.25 + view.panX, yA + view.panY, depth); P2.set(dir*hw*1.25 + view.panX, yB + view.panY, depth);
    P1.set(view.panX + (Math.random()-0.5)*hw*0.6, (yA+yB)/2 + (Math.random()-0.5)*hh*0.8 + view.panY, depth + (Math.random()-0.5)*0.4);
    dur = 22000 + Math.random()*14000; t0 = performance.now(); phase = Math.random()*10; active.visible = true;
    if (sfx.on) sfx.hover();
  }
  function bez(t, out){ const a = (1-t)*(1-t), b = 2*(1-t)*t, c = t*t; return out.set(a*P0.x+b*P1.x+c*P2.x, a*P0.y+b*P1.y+c*P2.y, a*P0.z+b*P1.z+c*P2.z); }
  function step(now, dt){
    if (!active){ if (now > nextAt) launch(); return; }
    const p = (now - t0)/dur;
    if (p >= 1){ active.visible = false; active = null; nextAt = now + 120000 + Math.random()*180000; return; }   // next visit in 2–5 min
    prev.copy(active.position); bez(p, active.position);
    const k = active.userData.kind, tt = now/1000 + phase;
    if (k === "saucer"){ active.rotation.y += dt*1.6; active.rotation.z = Math.sin(tt*1.3)*0.12; active.position.y += Math.sin(tt*2.2)*0.004; active.userData.lights.forEach((l,i) => l.material.emissiveIntensity = 0.5 + 0.9*Math.max(0, Math.sin(tt*6 + i*0.8))); }
    else if (k === "rocket"){ tmp.copy(active.position).sub(prev); if (tmp.lengthSq() > 1e-10){ tmp.normalize(); active.quaternion.setFromUnitVectors(UP, tmp); } active.userData.flame.scale.set(1, 0.8 + 0.4*Math.random(), 1); }
    else if (k === "alien"){ active.rotation.y = Math.sin(tt*0.9)*0.6; active.position.y += Math.sin(tt*3)*0.003; active.userData.ring.rotation.z += dt*2; }
    else { active.rotation.x += dt*0.25; active.rotation.y += dt*0.4; }
  }
  function hit(px, py){
    if (!active || !active.visible) return false;
    tmp.copy(active.position).project(camera); const x = VX + (tmp.x+1)/2*VW, y = VY + (1-tmp.y)/2*VH;
    if (Math.hypot(px-x, py-y) > 20) return false;
    const remaining = Math.max(0, 1 - (performance.now()-t0)/dur); t0 = performance.now() - (1-remaining)*1400; dur = 1400;   // zip off
    sfx.pin(); return true;
  }
  return { step, launch, hit, group, ships };
})();

/* ---- view controls (Google-Maps style): press-and-hold repeats ---- */
function hold(el, fn){
  let raf = 0, last = 0;
  const step = now => { const dt = Math.min(0.05, (now - last)/1000 || 0.016); last = now; fn(dt); raf = requestAnimationFrame(step); };
  const start = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch(_){} last = performance.now(); fn(0.016); if (!raf) raf = requestAnimationFrame(step); touchUI(); };
  const stop = () => { if (raf){ cancelAnimationFrame(raf); raf = 0; } touchUI(); };
  el.addEventListener("pointerdown", start);
  ["pointerup","pointercancel","pointerleave","lostpointercapture"].forEach(ev => el.addEventListener(ev, stop));
  el.addEventListener("contextmenu", e => e.preventDefault());
}
document.querySelectorAll("#nav .pb").forEach(b => {
  const x = +b.dataset.x, y = +b.dataset.y, act = b.dataset.act;
  hold(b, dt => {
    if (act === "rot"){ view.tYaw += x*1.4*dt; view.tPitch = clamp(view.tPitch + y*1.1*dt, -80*deg, 80*deg); }
    else panBy(x*420*dt, y*420*dt);
  });
});
hold($("#navIn"),  dt => { view.tDist = clamp(view.tDist*Math.exp(-1.6*dt), view.minDist, view.maxDist); });
hold($("#navOut"), dt => { view.tDist = clamp(view.tDist*Math.exp( 1.6*dt), view.minDist, view.maxDist); });
$("#navFit").addEventListener("click", resetView);
$("#navNorth").addEventListener("click", () => { view.tPitch = 0; view.tPanX = view.tPanY = 0; view.autoPan = false; view.flying = true; view.lastInteract = performance.now(); sfx.toggle(); });
$("#navNorth").addEventListener("dblclick", resetView);
const compassEl = $("#compass"); let compassYaw = 999;
function updateCompass(){ const a = Math.round(-view.yaw/deg); if (a !== compassYaw){ compassYaw = a; compassEl.style.transform = `rotate(${a}deg)`; } }

export {
  renderer, scene, camera, world, canvas,
  R, MAX_BRICKS, DC_BRICK, CITY_BRICK, CITY_SLOTS,
  LAYERS, setLayer, setPowerMap, landDots, dcMesh,
  towers, cityTowers, bricks, studs, brickColors, targetBricks, animateTower, stepTowers, stepFocus, setFocus, setTowerTint, focus, retarget,
  cityObjects, showCities, clearArcs, showArcs, stepArcs, ring, placeRing, placeRingAt,
  applyView, panBy, zoomAt, isNarrow, panelWidth, measureCanvas, resize, fitDistFor, flyTo,
  toScreen, castAt, hitTest, endPointer, dragging, lastPointerType, markSelected, stepHover, showTip, setHover,
  setMode, resetView, eggs, updateCompass,
  quality, setQuality, contact, BRICKS_PER_INDEX_POINT, noiseTex, studTex, discTex, arcCount
};
