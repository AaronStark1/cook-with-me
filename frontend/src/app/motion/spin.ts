/** Surprise-me wheel maths (pure, unit-tested). Angles in degrees, clockwise, 0 = 12 o'clock. */

export const SPIN_MS = 2800;
export const SPIN_EASING: [number, number, number, number] = [0.12, 0.8, 0.2, 1];
export const WHEEL_MAX = 8;

/**
 * Total clockwise rotation that parks slot `winner` (of `count`) under the
 * marker after `turns` whole turns. Slot k rests at k × 360/count.
 */
export function landingRotation(winner: number, count: number, turns: number): number {
  if (count <= 0) return 0;
  const step = 360 / count;
  return turns * 360 + ((360 - winner * step) % 360);
}

/** Where slot `slot` ends up (0 = under the marker) after rotating the wheel by `rotation`. */
export function slotAngleAfter(slot: number, count: number, rotation: number): number {
  const angle = (slot * (360 / count) + rotation) % 360;
  return (angle + 360) % 360;
}

/** A cubic-bezier easing as y(x), solved by bisection (the same curve CSS uses). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number) => {
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
export function invertEasing(ease: (t: number) => number, progress: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < progress) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface Crossing { slot: number; time: number }

/**
 * When each dish passes the marker during a spin of `total` degrees lasting
 * `duration` ms — used to schedule the little scale pulses up front (no rAF loop).
 */
export function crossings(total: number, count: number, duration = SPIN_MS, easing = SPIN_EASING): Crossing[] {
  if (count <= 0 || total <= 0) return [];
  const ease = cubicBezier(...easing);
  const step = 360 / count;
  const out: Crossing[] = [];
  for (let slot = 0; slot < count; slot++) {
    // slot passes the top whenever rotation ≡ −slot × step (mod 360)
    for (let r = (360 - slot * step) % 360 || 360; r <= total + 1e-6; r += 360) {
      out.push({ slot, time: invertEasing(ease, r / total) * duration });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Up to WHEEL_MAX distinct recipes for the wheel, always including the winner, in list order. */
export function wheelSet<T>(visible: readonly T[], winner: T, max = WHEEL_MAX): T[] {
  const distinct = [...new Set(visible)];
  if (distinct.length <= max) return distinct;
  const at = distinct.indexOf(winner);
  // a window of the list around the winner keeps neighbours recognisable
  const start = Math.max(0, Math.min(distinct.length - max, at - Math.floor(max / 2)));
  return distinct.slice(start, start + max);
}
