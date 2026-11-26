/**
 * The app's motion maths, ported verbatim for the reel's compositor (reel.html), its score
 * (lib/score.js) and its edit (timeline.mjs). A plain ES module: it runs in Node and in the page.
 *
 *  - cover(t)               frontend/src/app/motion/tokens.ts  (the measured wipe curve; do not retune)
 *  - cubicBezier(...)       frontend/src/app/motion/spin.ts    (bisection solver, the curve CSS uses)
 *  - invertEasing, landingRotation, crossings
 *                           frontend/src/app/motion/spin.ts    (the Surprise wheel's ratchet times)
 *  - the easing tokens      frontend/src/motion.css / tokens.ts
 */

// ---- The measured coverage curve (tokens.ts: do not retune) ----------------------------------
const T = [0, 0.031, 0.134, 0.206, 0.278, 0.34, 0.412, 0.485, 0.546, 0.583, 0.62, 0.69, 0.79, 0.85, 0.93, 1];
const C = [0, 0.006, 0.012, 0.023, 0.047, 0.07, 0.105, 0.158, 0.246, 0.55, 0.825, 0.9, 0.94, 0.956, 0.975, 1];
const smooth = (k) => 3 * k * k - 2 * k * k * k;

/** Coverage of the leaving layer at `t` (both 0–1): slow start, a rush through the middle, a long soft landing. */
export function cover(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let i = 0;
  while (T[i + 1] < t) i++;
  return C[i] + (C[i + 1] - C[i]) * smooth((t - T[i]) / (T[i + 1] - T[i]));
}

/** d cover / d t (numerical, per unit of t): the whoosh's gain follows this. */
export function coverRate(t, h = 1e-4) {
  return (cover(Math.min(1, t + h)) - cover(Math.max(0, t - h))) / (Math.min(1, t + h) - Math.max(0, t - h));
}

/** Where cover() rushes fastest (≈ 0.575 of the run): the beat a wipe is aimed at. */
export const COVER_RUSH = (() => {
  let best = 0, at = 0;
  for (let i = 1; i < 2000; i++) {
    const t = i / 2000, r = coverRate(t);
    if (r > best) { best = r; at = t; }
  }
  return at;
})();

// ---- cubic-bezier, solved by bisection (spin.ts) ---------------------------------------------
export function cubicBezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

/** Time (0–1) at which an increasing easing reaches `progress`. */
export function invertEasing(ease, progress) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < progress) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---- the Surprise wheel (spin.ts) ---------------------------------------------------------------
export const SPIN_MS = 2800;
export const SPIN_EASING = [0.12, 0.8, 0.2, 1];

export function landingRotation(winner, count, turns) {
  if (count <= 0) return 0;
  const step = 360 / count;
  return turns * 360 + ((360 - winner * step) % 360);
}

/** When each dish passes the marker during a spin of `total` degrees lasting `duration` ms. */
export function crossings(total, count, duration = SPIN_MS, easing = SPIN_EASING) {
  if (count <= 0 || total <= 0) return [];
  const ease = cubicBezier(...easing);
  const step = 360 / count;
  const out = [];
  for (let slot = 0; slot < count; slot++) {
    for (let r = (360 - slot * step) % 360 || 360; r <= total + 1e-6; r += 360) {
      out.push({ slot, time: invertEasing(ease, r / total) * duration });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

// ---- easing tokens (motion.css) -------------------------------------------------------------------
export const ease = cubicBezier(0.2, 0.7, 0.2, 1);
export const easeArrive = cubicBezier(0.22, 0.8, 0.3, 1);
export const easeGlide = cubicBezier(0.65, 0, 0.35, 1);
export const easeOutQuad = cubicBezier(0.5, 1, 0.89, 1);
/** The hero's wheel curve (and the platter spin's): the wipe's cubic form. */
export const easeWheel = cubicBezier(0.65, 0.02, 0.2, 1);
/** Mask-rise reveals use --ease-arrive too. */
export const easeMask = easeArrive;

/** Wipe parallax constants (tokens.ts). */
export const WIPE_DRIFT = 0.14;
export const ARRIVE_START = 0.5;
export const ARRIVE_SPAN = 0.42;
