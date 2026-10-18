# Repository map

Static, no-build exhibit deployed by GitHub Pages from `main` (custom domain in `CNAME`). Do not add a bundler, package.json or framework. Three.js r160 is a global (`THREE`) from the cdnjs script tag in `index.html`; the app code is ES modules loaded by `<script type="module" src="js/main.js">`, so local testing needs HTTP (`node tools/serve.js`), not `file://`.

## 1. Framework and hosting
- No framework. `index.html` is markup only; `styles.css` is the whole stylesheet; `js/*.js` are native ES modules with relative imports.
- GitHub Pages serves `main` as-is. `CNAME` = whogetstobuildwithai.com. Cache-control is GitHub's default (max-age 600), so a hard refresh is needed to see a deploy straight away.

## 2. 3D rendering and the camera
- `js/scene.js` owns everything Three.js: renderer, scene, `camera` (PerspectiveCamera, fov 38) and the `world` group that rotates.
- Globe: sphere + rim/atmosphere shader meshes; land as a dot matrix sampled from `LAND_MASK` (2° cells, in scene.js); data layers (`LAYERS`, `setLayer`) recolour the dots.
- Towers: two InstancedMeshes (`bricks`, `studs`) shared by countries, continents and six reusable city slots (`towers`, `cityTowers`); `writeTower`/`paintTower`/`stepTowers` animate them. Data centres are a third InstancedMesh (`dcMesh`) with shader halos. Arcs (`showArcs`) and a selection `ring` complete the scene.
- Camera: `view` (in `js/state.js`) holds yaw/pitch/dist/pan and their targets; `applyView()` writes them to the world quaternion and camera position each frame; `resize()` uses `camera.setViewOffset` to centre the globe beside the side panel or above the open bottom sheet; `flyTo(ref, dist, towerLen)` targets a tower; `zoomAt`, `panBy`, `resetView` are the other movers. The frame loop in `js/main.js` eases `view` towards its targets and auto-rotates after 3 s idle.
- Picking: `castAt(px, py)` ray-casts in the world-local frame against every drawn brick (globe occludes); `hitTest` adds a tolerance ring (nearest-wins); `endPointer` resolves taps at the touch-down point and calls `select` / `selectDC` / `focusCity`.

## 3. Data
- `data/countries.js` (62 records; field-by-field JSDoc at the top), `data/datacentres.js` (49, each with `sourceUrl` or `estimated:true`), `data/continents.js` (6), `data/sources.js` (the source table).
- Every numeric country field is a provenance object `{ value, source, year, estimated }`. `normalise()` in `js/model.js` unwraps them at load, so the app reads plain numbers and finds the provenance under `c.provenance[field]`; `isEstimated(c, field)` is the helper. Sourced: population, GDP per capita, internet penetration, electricity access (World Bank), data cost per GB (Cable.co.uk 2023), usage index (Anthropic Economic Index, a Claude-usage proxy, 56 of 62 countries). Derived: subscriptionShareOfIncome = (20×12)/gdpPerCapita×100. Estimated wholesale: activeUsers, providerShare, growthCurve, cities, capabilities, barriers, facts.
- Regenerate with `node tools/fetch-data.mjs` (or `--offline` to reuse `data/raw/`). Raw downloads and their terms: `data/raw/LICENSES.md`. The Cable.co.uk workbook is gitignored.
- `js/model.js` joins the data modules into `DATA` and derives `dcCount`, `access` (via `js/accessGap.js`), `servedBy` (in scene.js) and the continent aggregates `CONT`.
- `js/colors.js`: `PROVIDER_COLOR`, `OPERATOR_COLOR`, `CONTINENT_COLOR` and `CSS_TOKENS`, a mirror of the `:root` tokens in `styles.css` (styles.css is the source of truth).

## 4. Intro overlay and side panel
- Intro: `#intro` markup in `index.html` (styles under `#intro`, `.ibox` in `styles.css`); dismissal logic at the bottom of `js/main.js` (click, any key, 9.4 s timer, `?nointro`). Example-search buttons carry `data-q`.
- Panel: `<aside id="panel">` with tabs Usage / Spend / Access / Key (Key is phone-only) and the card view `#v-card`. `js/panel.js` fills the lists, renders `cardHTML(ref)` and the data-centre card, handles search, pins, the bottom-sheet drag on phones (`.strip` = tucked away, `syncSheet()` re-centres the globe) and the live counters (`tickCounters`).

## 5. Head metadata
- `index.html` head: charset, viewport (no user zoom), mobile-web-app metas, `<title>` "Who gets to build with AI?", description (<155 chars), canonical, `og:*` and `twitter:*` tags pointing at `https://whogetstobuildwithai.com/og.png` (1200×630), favicons, `site.webmanifest`, `theme-color`.
- `og.png` is rendered from `tools/og-template.html` by `tools/render-og.mjs` (plain HTML + inline SVG, no WebGL); the hero stat is the `HERO_STAT` constant in the template (placeholder, marked TODO).

## 6. Routing and URL state
- None. The only URL input is `?nointro` (read in `js/main.js`). Selection, tab and layer are in-memory (`state` in `js/state.js`); `keyCollapsed` is the only persisted preference (localStorage).

## 7. Styling
- Tokens on `:root` in `styles.css`: `--bg #07080c`, `--panel`, `--line`, `--fill`, `--text #f5f5f7`, `--muted`, `--accent` (monochrome; no yellow accent), `--ease`, `--panel-w 420px`, plus `--c-*` provider and `--o-*` operator colours.
- Font: system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, …`). Panels are frosted glass (`backdrop-filter: var(--glass)`), 18px radii, 1px `--line` borders. Phone layout (`max-width:900px portrait` or `max-width:600px`) turns the panel into a bottom sheet.

## Testing
- `NODE_PATH=<dir with puppeteer> node tools/behaviour-check.js out.json [baseline.json]` snapshots the UI (intro, ZA card values, tabs, layers, resetView, `?nointro`) and diffs against a baseline. Use it before and after any refactor.
- `tools/tower-pick-test.js`, `tools/tower-tap-sweep.js` and `tools/mobile-audit.js` predate the module split and reach into page globals of the old single-file build; they need porting to a debug hook before they run again.
