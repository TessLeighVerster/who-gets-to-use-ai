import { $ } from "./util.js";

/* sound: tiny synthesised cues, on from the start. Browsers only let audio play after a gesture, so the context is unlocked on the first tap, click or key press. */
export const sfx = (() => {
  let ctx = null, master = null, on = false, lastClick = 0;
  const ensure = () => { if (!ctx){ ctx = new (window.AudioContext||window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination); } if (ctx.state === "suspended") ctx.resume(); };
  const tone = (freq, dur, type, gain, sweepTo) => {
    if (!on || !ctx) return; const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t0+dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0+0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0+dur+0.02);
  };
  return {
    get on(){ return on; },
    set(v){ on = v; if (on){ try { ensure(); } catch(e){ on = false; } } $("#soundToggle").classList.toggle("on", on); $("#soundToggle").setAttribute("aria-pressed", on); },
    brick(k, up){ if (!on) return; const now = performance.now(); if (now - lastClick < 28) return; lastClick = now; tone(520 + k*38 + Math.random()*40, 0.05, "triangle", up ? 0.16 : 0.09); },
    hover(){ tone(1800, 0.025, "sine", 0.05); },
    select(){ tone(330, 0.32, "sine", 0.18, 660); tone(495, 0.28, "sine", 0.06, 990); },
    close(){ tone(520, 0.22, "sine", 0.12, 260); },
    toggle(){ tone(220, 0.12, "triangle", 0.14, 180); },
    pin(){ tone(880, 0.08, "square", 0.05); tone(1320, 0.1, "square", 0.04); },
    unlock(){ if (on){ try { ensure(); } catch(e){} } }
  };
})();
sfx.set(true);
["pointerdown","keydown","touchstart"].forEach(ev => window.addEventListener(ev, () => sfx.unlock(), {passive:true, capture:true}));
