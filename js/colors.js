/* Palette: who makes the models (towers) and who runs the data centres (glowing bricks).
   The hex numbers feed Three.js. styles.css carries the same values as CSS custom properties
   (--c-anthropic … --c-local, --o-aws … --o-other); CSS_TOKENS mirrors the rest of its :root block. */
export const PROVIDERS = ["anthropic","openai","google","meta","mistral","deepseek","local"];
export const PROVIDER_LABEL = {anthropic:"Anthropic",openai:"OpenAI",google:"Google",meta:"Meta",mistral:"Mistral",deepseek:"DeepSeek",local:"Local / other"};
export const PROVIDER_COLOR = {anthropic:0xd97757,openai:0xf5f5f0,google:0x4285f4,meta:0x6366f1,mistral:0xff6a00,deepseek:0x2dd4bf,local:0x8a8f98};
export const OPERATORS = ["aws","microsoft","google","meta","oracle","other"];
export const OPERATOR_LABEL = {aws:"AWS",microsoft:"Microsoft",google:"Google",meta:"Meta",oracle:"Oracle",other:"Other"};
export const OPERATOR_COLOR = {aws:0xf59e0b,microsoft:0x7fba00,google:0x4285f4,meta:0x6366f1,oracle:0xf0453a,other:0xe879f9};
export const CONTINENT_COLOR = {"North America":"#f4c76b","Europe":"#e8a862","Asia":"#c7a2ff","Oceania":"#7fd6c2","South America":"#8fb8ff","Africa":"#f08a8a"};

/* Mirror of the design tokens declared on :root in styles.css. styles.css is the source of truth; this copy is for
   scripts that draw with the same colours (canvas, SVG) without reading computed styles. Keep the two in step. */
export const CSS_TOKENS = {
  bg:"#07080c", panel:"rgba(24,24,27,0.72)", line:"rgba(255,255,255,0.08)", fill:"rgba(120,120,128,0.22)", fillStrong:"rgba(255,255,255,0.14)",
  text:"#f5f5f7", muted:"rgba(245,245,247,0.6)", accent:"#f5f5f7", accentDim:"rgba(255,255,255,0.10)", panelW:420,
  shadow:"0 12px 40px rgba(0,0,0,.38)", ease:"cubic-bezier(.22,.8,.3,1)",
  font:'-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif'
};
