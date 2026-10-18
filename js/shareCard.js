/* Share a country's card: a 1080×1080 PNG drawn on an offscreen canvas from the same template as the link previews.
   navigator.share with the file where the browser supports it (iOS Safari, Android Chrome); otherwise the PNG is
   downloaded and the deep link copied, with a toast either way. */
import { DATA } from "./model.js";
import { cardModel, drawCard, SITE } from "./cardTemplate.js";

const SIZE = 1080;
export const countryUrl = iso => `https://${SITE}/c/${iso}/`;
export const shareText = c => `Here's where ${c.name} stands on AI access. See yours: ${countryUrl(c.iso)}`;

export async function renderCardBlob(c, type = "image/png"){
  const cv = document.createElement("canvas"); cv.width = cv.height = SIZE;
  const ctx = cv.getContext("2d");
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  drawCard(ctx, cardModel(c, DATA.countries), SIZE, SIZE);
  return new Promise(res => cv.toBlob(res, type));
}

let toastEl = null, toastT = 0;
export function toast(msg){
  if (!toastEl){ toastEl = document.getElementById("toast"); if (!toastEl){ toastEl = document.createElement("div"); toastEl.id = "toast"; document.body.appendChild(toastEl); } }
  toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

export async function shareCountry(c){
  const blob = await renderCardBlob(c);
  const file = new File([blob], `${c.iso}-ai-access.png`, { type: "image/png" });
  const text = shareText(c), url = countryUrl(c.iso);
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
    try { await navigator.share({ files: [file], text, title: `Where ${c.name} stands on AI access` }); return "shared"; }
    catch (e){ if (e && e.name === "AbortError") return "cancelled"; }   // user closed the sheet: not an error; anything else falls through to download
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  let copied = false;   // the clipboard call can hang when the page is not focused (or in automation), so it gets a short deadline
  try { await Promise.race([navigator.clipboard.writeText(url), new Promise((_, rej) => setTimeout(() => rej(new Error("clipboard timeout")), 1500))]); copied = true; } catch (_) {}
  toast(copied ? `Card saved · link copied: ${url}` : `Card saved · ${url}`);
  return copied ? "downloaded+copied" : "downloaded";
}
