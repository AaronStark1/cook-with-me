/**
 * Virtual time for filming the real app frame by frame.
 *
 * Copied from tools/readme-media/lib/vclock.js (itself adapted from the SpecShield showreel) and
 * extended for the reel's 180 fps subframes. Injected before any page script, it replaces the
 * page's clocks (performance.now, Date, event timestamps) and schedulers (timers,
 * requestAnimationFrame, idle callbacks) with ones that only move when the capture calls
 * `__vt.step(ms)`. CSS animations, CSS transitions, Web Animations and View Transition
 * pseudo-elements are pinned to the same clock, so every frame is a pure function of the scripted
 * inputs and re-running a shot reproduces it.
 *
 * What this copy adds to the README tool's clock:
 *  1. Animations the PAGE controls are left to the page. `Animation.prototype.pause`, `play` and
 *     the `currentTime` setter are wrapped before any page script runs: a page pause marks the
 *     animation app-controlled (the Assembly Demo's scroll scrub), a page `currentTime` write on a
 *     running animation becomes that animation's new local time (instead of being overwritten on
 *     the next step), and a page `play()` hands it back to the clock from where it stands.
 *  2. Each driven animation keeps its own local time and advances by `dt × playbackRate`
 *     (the marquee changes its rate with scroll velocity), not by `now − born`.
 *  3. An animation that reaches its end is `finish()`ed — CSS transitions included, so
 *     `transitionend` fires and `finished` promises resolve (the hero clears its leaving colour
 *     panel, Cook Mode drops the old step, View Transitions end).
 *  4. `Math.random` is a seeded PRNG with a scripted queue: `__vt.rand([0.25, 0.6])` makes the
 *     next two calls return exactly those values (the Surprise wheel's winner and turn count).
 *  5. An animation first seen by the clock starts at local time 0 (or at the time the page set),
 *     never at whatever real time elapsed before the clock saw it.
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

  // ---- randomness: a seeded PRNG (mulberry32) behind a scripted queue
  let seed = 0x5eed1e55 >>> 0;
  const prng = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const randQueue = [];
  const randLog = [];
  Math.random = () => {
    const scripted = randQueue.length > 0;
    const value = scripted ? randQueue.shift() : prng();
    randLog.push({ at: now, value, scripted });
    return value;
  };

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

  // ---- animations -----------------------------------------------------------------------------
  const P = Animation.prototype;
  const ct = Object.getOwnPropertyDescriptor(P, "currentTime");
  const nativePause = P.pause;
  const nativePlay = P.play;
  /** Paused by the page itself (a scrubbed timeline): never driven, never re-pinned. */
  const appPaused = new WeakSet();
  /** Local time of each animation the clock drives, and the virtual time it was last advanced at. */
  const local = new WeakMap();
  const lastAt = new WeakMap();
  /** Where a CSS-paused animation (animation-play-state: paused) stood when last seen. */
  const frozen = new WeakMap();
  let internal = false;
  const stats = { appPaused: 0, pageSeeks: 0, pagePlays: 0, finished: 0 };

  P.pause = function () {
    if (!internal) {
      appPaused.add(this);
      stats.appPaused++;
    }
    return nativePause.call(this);
  };
  P.play = function () {
    const result = nativePlay.call(this);
    if (!internal) {
      // the page hands the animation back: keep driving it from where it stands
      appPaused.delete(this);
      const t = Number(ct.get.call(this)) || 0;
      local.set(this, t);
      lastAt.set(this, now);
      stats.pagePlays++;
    }
    return result;
  };
  Object.defineProperty(P, "currentTime", {
    configurable: true,
    enumerable: ct.enumerable,
    get: ct.get,
    set(value) {
      const driven = local.has(this) || this.playState !== "paused";
      if (!internal && !appPaused.has(this) && driven && value !== null && Number.isFinite(Number(value))) {
        // a seek on a running animation: that is its new local time, from this virtual moment
        local.set(this, Number(value));
        lastAt.set(this, now);
        stats.pageSeeks++;
      }
      ct.set.call(this, value);
    },
  });

  const isScrollDriven = (a) => a.timeline && typeof DocumentTimeline !== "undefined" && !(a.timeline instanceof DocumentTimeline);

  /** Puts every clock-driven animation at its local time for the current virtual time. */
  function pinAnimations() {
    internal = true;
    try {
      for (const a of document.getAnimations()) {
        // scroll-driven animations already follow the (scripted) scroll position
        if (isScrollDriven(a)) continue;
        if (appPaused.has(a)) continue;
        if (a.playState === "finished" || a.playState === "idle") continue;
        let t;
        if (!local.has(a)) {
          // paused by CSS (animation-play-state) and never driven by this clock: leave it frozen
          if (a.playState === "paused") {
            frozen.set(a, Number(ct.get.call(a)) || 0);
            continue;
          }
          // first sight: from 0 (or where CSS had frozen it), never from real time already elapsed
          t = frozen.has(a) ? frozen.get(a) : 0;
        } else {
          const rate = Number.isFinite(a.playbackRate) ? a.playbackRate : 1;
          t = local.get(a) + (now - (lastAt.get(a) ?? now)) * rate;
        }
        local.set(a, t);
        lastAt.set(a, now);
        if (a.playState !== "paused") nativePause.call(a);
        const timing = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
        const end = timing ? timing.endTime : Infinity;
        if (Number.isFinite(end) && t >= end) {
          ct.set.call(a, end);
          // finish(), for CSS transitions too: transitionend fires and finished promises resolve
          try {
            a.finish();
          } catch {}
          stats.finished++;
          local.delete(a);
          lastAt.delete(a);
        } else ct.set.call(a, Math.max(0, t));
      }
    } finally {
      internal = false;
    }
  }

  // ---- View Transitions: from startViewTransition() until its ready promise settles, Chrome suppresses rendering.
  // Nothing may wait on paint in that window (an image load, a screenshot), or Chrome's 4 s
  // real-time "DOM update timed out" fires and the transition is skipped. The capture drains a
  // pending transition with zero-length steps, so it starts at the virtual moment it was asked for.
  const pendingVT = new Set();
  const nativeSVT = Document.prototype.startViewTransition;
  let vtCount = 0;
  if (typeof nativeSVT === "function") {
    Document.prototype.startViewTransition = function (...args) {
      const transition = nativeSVT.apply(this, args);
      const token = { at: now };
      pendingVT.add(token);
      vtCount++;
      const clear = () => pendingVT.delete(token);
      transition.ready.then(clear, clear);
      transition.finished.then(clear, clear);
      return transition;
    };
  }

  /** Waits (in real time, at most maxMs) for on-screen images that are still loading. */
  function settleImages(maxMs) {
    if (pendingVT.size) return Promise.resolve();
    // only images on screen: an off-screen lazy image never loads and would stall every frame
    const pending = [...document.images].filter((i) => {
      if (!i.src || i.complete) return false;
      const r = i.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 0;
    });
    if (!pending.length) return Promise.resolve();
    return Promise.race([
      Promise.all(pending.map((i) => new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); }))),
      new Promise((r) => realSetTimeout(r, maxMs)),
    ]);
  }

  /** On-screen images that are not usable yet (not loaded, or the plate fallback). */
  function brokenImages() {
    return [...document.images]
      .filter((i) => {
        const r = i.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 2;
      })
      .filter((i) => !i.complete || !(i.naturalWidth > 0) || /plate\.svg$/.test(i.currentSrc || i.src))
      .map((i) => i.currentSrc || i.src || "(no src)");
  }

  window.__vt = {
    get now() {
      return now;
    },
    realWait: (ms) => new Promise((r) => realSetTimeout(r, ms)),
    /** Advances virtual time by ms, settles animations at the new time and lets images land. */
    async step(ms) {
      // anything the page started between steps (a response, a lazy chunk) starts at this moment
      pinAnimations();
      advance(ms);
      pinAnimations();
      await settleImages(1500);
      // one real turn so the compositor paints what the step changed
      await new Promise((r) => realSetTimeout(r, 0));
      pinAnimations();
    },
    pinAnimations,
    brokenImages,
    /** The next Math.random() calls return these values, in order. */
    rand(values) {
      randQueue.push(...values);
    },
    get randLog() {
      return randLog.slice();
    },
    get randPending() {
      return randQueue.length;
    },
    get stats() {
      return { ...stats, timers: timers.size, frames: frames.size, viewTransitions: vtCount };
    },
    /** A view transition is waiting for its DOM update or its snapshots (rendering is suppressed). */
    get vtPending() {
      return pendingVT.size > 0;
    },
  };
})();
`;
