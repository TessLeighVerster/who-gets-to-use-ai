/* Palette: who makes the models (towers) and who runs the data centres (glowing bricks).
   The hex numbers feed Three.js. styles.css carries the same values as CSS custom properties
   (--c-anthropic … --c-local, --o-aws … --o-other); CSS_TOKENS mirrors the rest of its :root block. */
export const PROVIDERS = ["anthropic","openai","google","meta","mistral","deepseek","local"];
export const PROVIDER_LABEL = {anthropic:"Anthropic",openai:"OpenAI",google:"Google",meta:"Meta",mistral:"Mistral",deepseek:"DeepSeek",local:"Local / other"};
/* Painted-block palette (after the stacked painted-wood reference): chalky, lighter tones, warm cream instead of white, a warm
   mid-grey for Local / other; each hue stays distinct from its neighbours. Checked side by side (legend vs tower) and under a deuteranopia simulation: tools/palette-check.mjs. */
export const PROVIDER_COLOR = {anthropic:0xe08a6a,openai:0xefe9d6,google:0x5b8fd6,meta:0x8e66b8,mistral:0xf08a4a,deepseek:0x5cc4ad,local:0xa09a8e};
export const OPERATORS = ["aws","microsoft","google","meta","oracle","other"];
export const OPERATOR_LABEL = {aws:"AWS",microsoft:"Microsoft",google:"Google",meta:"Meta",oracle:"Oracle",other:"Other"};
export const OPERATOR_COLOR = {aws:0xe6b04a,microsoft:0x8fb85a,google:0x5b8fd6,meta:0x8e66b8,oracle:0xe0655a,other:0xe08cd8};
export const CONTINENT_COLOR = {"North America":"#f4c76b","Europe":"#e8a862","Asia":"#c7a2ff","Oceania":"#7fd6c2","South America":"#8fb8ff","Africa":"#f08a8a"};

/* Mirror of the design tokens declared on :root in styles.css. styles.css is the source of truth; this copy is for
   scripts that draw with the same colours (canvas, SVG) without reading computed styles. Keep the two in step. */
export const CSS_TOKENS = {
  bg:"#22252d", panel:"rgba(32,34,42,0.72)", line:"rgba(255,255,255,0.08)", fill:"rgba(120,120,128,0.22)", fillStrong:"rgba(255,255,255,0.14)",
  text:"#f5f5f7", muted:"rgba(245,245,247,0.6)", accent:"#f5f5f7", accentDim:"rgba(255,255,255,0.10)", panelW:420,
  shadow:"0 12px 40px rgba(0,0,0,.38)", ease:"cubic-bezier(.22,.8,.3,1)",
  font:'-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif'
};
