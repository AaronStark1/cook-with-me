/**
 * Motion tokens — the JS mirror of `src/motion.css`. Single source of truth for
 * every scripted animation (WAAPI); CSS-only motion reads the same values from
 * the custom properties.
 */

export const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
export const EASE_ARRIVE = 'cubic-bezier(0.22, 0.8, 0.3, 1)';
export const EASE_GLIDE = 'cubic-bezier(0.65, 0, 0.35, 1)';
export const EASE_OUT_QUAD = 'cubic-bezier(0.5, 1, 0.89, 1)';
/** Used when the browser has no `linear()` easing. */
export const EASE_WIPE_FALLBACK = 'cubic-bezier(0.65, 0.02, 0.2, 1)';

export const DUR = {
  micro: 120,
  ui: 200,
  reveal: 700,
  wipeHero: 970,
  wipePage: 640,
  wipeStep: 640,
} as const;

/** How far the leaving content drifts during a wipe, as a fraction of the container width. */
export const WIPE_DRIFT = 0.14;
/** Incoming parallax: starts at 50 % of the run, lasts 42 %, lands at 92 %. */
export const ARRIVE_START = 0.5;
export const ARRIVE_SPAN = 0.42;

// ---- The measured coverage curve (do not retune) ---------------------------
const T = [0, 0.031, 0.134, 0.206, 0.278, 0.34, 0.412, 0.485, 0.546, 0.583, 0.62, 0.69, 0.79, 0.85, 0.93, 1];
const C = [0, 0.006, 0.012, 0.023, 0.047, 0.07, 0.105, 0.158, 0.246, 0.55, 0.825, 0.9, 0.94, 0.956, 0.975, 1];
const smooth = (k: number) => 3 * k * k - 2 * k * k * k;

/** Coverage of the leaving layer at `t` (both 0–1): slow start, a rush through the middle, a long soft landing. */
export function cover(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let i = 0;
  while (T[i + 1] < t) i++;
  return C[i] + (C[i + 1] - C[i]) * smooth((t - T[i]) / (T[i + 1] - T[i]));
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/**
 * `cover()` as a CSS `linear()` easing string for WAAPI: every table point, with
 * extra stops where the curve rushes. (`--ease-wipe` in motion.css is a hand-written
 * 38-point sampling of the same curve; a unit test checks both against `cover()`.)
 */
export function wipeLinearEasing(): string {
  const stops: string[] = ['0'];
  for (let i = 0; i < T.length - 1; i++) {
    const span = T[i + 1] - T[i];
    // dense where the curve rushes, sparse where it barely moves
    const cuts = C[i + 1] - C[i] > 0.05 ? [0.25, 0.5, 0.75, 1] : [0.5, 1];
    for (const k of cuts) {
      const t = T[i] + span * k;
      if (t >= 1) continue;
      stops.push(`${round(cover(t), 4)} ${round(t * 100, 2)}%`);
    }
  }
  stops.push('1');
  return `linear(${stops.join(', ')})`;
}

let linearSupport: boolean | null = null;
export function supportsLinearEasing(): boolean {
  if (linearSupport === null) {
    linearSupport =
      typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timing-function', 'linear(0, 1)');
  }
  return linearSupport;
}

let wipeEasing: string | null = null;
/** The wipe curve for WAAPI `easing`, with the cubic-bezier fallback. */
export function WIPE_EASING(): string {
  return (wipeEasing ??= supportsLinearEasing() ? wipeLinearEasing() : EASE_WIPE_FALLBACK);
}
