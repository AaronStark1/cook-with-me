/**
 * Virtual time for filming the real app frame by frame (adapted from the SpecShield showreel's
 * vclock). Injected before any page script, it replaces the page's clocks (performance.now, Date,
 * event timestamps) and schedulers (timers, requestAnimationFrame, idle callbacks) with ones that
 * only move when the capture calls `__vt.step(ms)`. CSS animations, CSS transitions, Web
 * Animations and View Transition pseudo-elements are pinned to the same clock, so every frame is a
 * pure function of the scripted inputs and re-running a shot reproduces it.
 */
export const VCLOCK_SCRIPT = String.raw`
(() => {
  if (window.__vt) return;
  const EPOCH = Date.UTC(2026, 10, 25, 18, 30, 0);
  const NativeDate = Date;
  const realSetTimeout = window.setTimeout.bind(window);
  let now = 0;
  let seq = 1;
  const timers = new Map();
  const frames = new Map();

  performance.now = () => now;
  function FakeDate(...args) {
    if (!new.target) return new NativeDate(EPOCH + now).toString();
    return args.length ? new NativeDate(...args) : new NativeDate(EPOCH + now);
  }
  FakeDate.prototype = NativeDate.prototype;
  FakeDate.now = () => EPOCH + Math.floor(now);
  FakeDate.parse = NativeDate.parse;
  FakeDate.UTC = NativeDate.UTC;
  window.Date = FakeDate;
  Object.defineProperty(Event.prototype, "timeStamp", { get: () => now, configurable: true });

  const schedule = (fn, ms, args, repeat) => {
    const id = seq++;
    const delay = Math.max(repeat ? 1 : 0, Number(ms) || 0);
    timers.set(id, { id, at: now + delay, every: repeat ? delay : 0, fn, args });
    return id;
  };
  window.setTimeout = (fn, ms, ...args) => schedule(fn, ms, args, false);
  window.setInterval = (fn, ms, ...args) => schedule(fn, ms, args, true);
  window.clearTimeout = window.clearInterval = (id) => void timers.delete(id);
  window.requestAnimationFrame = (cb) => {
    const id = seq++;
    frames.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => void frames.delete(id);
  window.requestIdleCallback = (cb) => schedule(() => cb({ didTimeout: false, timeRemaining: () => 40 }), 1, [], false);
  window.cancelIdleCallback = window.clearTimeout;

  const call = (fn, args) => {
    try {
      if (typeof fn === "function") fn(...args);
    } catch (error) {
      console.error(error);
    }
  };

  /** Runs every timer due up to now + ms, in order, then one animation frame at the new time. */
  function advance(ms) {
    const target = now + ms;
    for (let guard = 0; guard < 100000; guard++) {
      let next = null;
      for (const t of timers.values()) if (t.at <= target && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t;
      if (!next) break;
      now = Math.max(now, next.at);
      if (next.every) next.at += next.every;
      else timers.delete(next.id);
      call(next.fn, next.args);
    }
    now = target;
    const due = [...frames.values()];
    frames.clear();
    for (const cb of due) call(cb, [now]);
  }

  // Every animation (CSS, WAAPI, view transition) is pinned to the virtual time it first appeared at.
  const born = new WeakMap();
  const pinned = new WeakSet(); // animations this clock paused (vs. ones the page paused itself)
  function pinAnimations() {
    for (const a of document.getAnimations()) {
      // scroll-driven animations already follow the (scripted) scroll position
      if (a.timeline && typeof DocumentTimeline !== "undefined" && !(a.timeline instanceof DocumentTimeline)) continue;
      // An animation the page paused is being scrubbed by the page (e.g. the Assembly Demo's
      // AssemblyTimeline sets currentTime from scroll); leave its currentTime alone.
      if (a.playState === "paused" && !pinned.has(a)) continue;
      let start = born.get(a);
      if (start === undefined) {
        // A WAAPI animation created with a negative delay or a seek keeps its offset.
        start = now - (Number(a.currentTime) || 0);
        born.set(a, start);
      }
      if (a.playState === "finished") continue;
      if (a.playState !== "paused") {
        a.pause();
        pinned.add(a);
      }
      const t = now - start;
      const timing = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      if (timing && t >= timing.endTime && timing.endTime !== Infinity) {
        a.currentTime = timing.endTime;
        if (a instanceof CSSTransition) a.cancel();
        else a.finish();
      } else a.currentTime = t;
    }
  }

  /** Waits (in real time, at most maxMs) for images that are still decoding or loading. */
  function settleImages(maxMs) {
    // only images on screen: an off-screen lazy image never loads and would stall every frame
    const pending = [...document.images].filter((i) => {
      if (!i.src || i.complete) return false;
      const r = i.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
    if (!pending.length) return Promise.resolve();
    return Promise.race([
      Promise.all(pending.map((i) => new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); }))),
      new Promise((r) => realSetTimeout(r, maxMs)),
    ]);
  }

  window.__vt = {
    get now() {
      return now;
    },
    realWait: (ms) => new Promise((r) => realSetTimeout(r, ms)),
    /** Advances virtual time by ms, settles animations at the new time and lets images land. */
    async step(ms) {
      advance(ms);
      pinAnimations();
      await settleImages(1500);
      // one real frame so the compositor paints what the step changed
      await new Promise((r) => realSetTimeout(r, 0));
      pinAnimations();
    },
  };
})();
`;

/**
 * A branded cursor drawn in the page (headless screenshots carry no OS cursor). It lives in the
 * top layer as a manual popover so it stays above native <dialog>s (Cook Mode, the wheel);
 * `__cursor.raise()` re-stacks it after a dialog opens. A press leaves a yolk ring.
 */
export const CURSOR_SCRIPT = String.raw`
(() => {
  const css = '#__cur{position:fixed;inset:auto;left:0;top:0;margin:0;padding:0;border:0;background:none;overflow:visible;width:30px;height:36px;pointer-events:none;translate:-200px -200px;z-index:2147483647}' +
    '#__cur svg{display:block;width:30px;height:36px;filter:drop-shadow(0 2px 0 rgba(28,15,10,.35))}' +
    '#__cur i{position:absolute;left:-22px;top:-22px;width:44px;height:44px;border:4px solid #FFC93C;border-radius:50%;box-sizing:border-box;opacity:0;scale:.4}' +
    '#__cur.down i{animation:__ring 520ms cubic-bezier(.2,.8,.2,1) forwards}' +
    '#__cur.down svg{scale:.9;transform-origin:0 0}' +
    '@keyframes __ring{0%{opacity:1;scale:.4}100%{opacity:0;scale:1.25}}';
  function mount() {
    if (document.getElementById("__cur")) return;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    const el = document.createElement("div");
    el.id = "__cur";
    el.setAttribute("popover", "manual");
    el.innerHTML = '<i></i><svg viewBox="0 0 30 36"><path d="M2 2 L2 29 L9.5 22.5 L14.5 33.5 L19.5 31.2 L14.6 20.4 L24.5 20.4 Z" fill="#1C0F0A" stroke="#FFF3E0" stroke-width="2.4" stroke-linejoin="round"/></svg>';
    document.body.appendChild(el);
    try { el.showPopover(); } catch {}
    window.addEventListener("pointermove", (e) => { el.style.translate = e.clientX + "px " + e.clientY + "px"; }, { capture: true, passive: true });
    window.addEventListener("pointerdown", () => { el.classList.remove("down"); void el.offsetWidth; el.classList.add("down"); }, { capture: true, passive: true });
  }
  window.__cursor = {
    raise() {
      const el = document.getElementById("__cur");
      if (!el) return mount();
      try { el.hidePopover(); el.showPopover(); } catch {}
    },
    hide(v) {
      const el = document.getElementById("__cur");
      if (el) el.style.visibility = v ? "hidden" : "";
    },
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
`;
