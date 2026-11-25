import { ARRIVE_SPAN, ARRIVE_START, DUR, EASE_OUT_QUAD, WIPE_DRIFT, WIPE_EASING } from './tokens';

/** +1 = forward / next (edge sweeps right → left), −1 = back / previous. */
export type WipeDir = 1 | -1;

export interface MotionHandle {
  /** Resolves when the animation has finished or been cancelled — never rejects. */
  finished: Promise<void>;
  /** Jump to the end state now ("latest wins"). */
  finish(): void;
  /** Remove the animation entirely, back to the underlying style. */
  cancel(): void;
}

const DONE: MotionHandle = { finished: Promise.resolve(), finish() {}, cancel() {} };

// ---- pure keyframe maths (unit-tested) ---------------------------------------

/** Clip that covers the leaving layer: forward eats it from the right, back from the left. */
export function wipeKeyframes(dir: WipeDir): Keyframe[] {
  const covered = dir === 1 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)';
  return [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: covered }];
}

/** The complement: what the wipe has already uncovered (incoming layers are only visible there). */
export function revealKeyframes(dir: WipeDir): Keyframe[] {
  const hidden = dir === 1 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
  return [{ clipPath: hidden }, { clipPath: 'inset(0 0 0 0)' }];
}

/** The leaving content drifts 14 % of the width against the direction of travel, locked to the wipe curve. */
export function driftKeyframes(dir: WipeDir, width: number): Keyframe[] {
  return [{ translate: '0px 0px' }, { translate: `${round(-dir * WIPE_DRIFT * width)}px 0px` }];
}

/**
 * A flat colour panel leaving with the 6 px edge attached to it. For a flat
 * colour, sliding the panel out is pixel-identical to clipping it — and it is a
 * single transform, so the edge can never drift from the colour boundary.
 */
export function sweepKeyframes(dir: WipeDir): Keyframe[] {
  return [{ translate: '0px 0px' }, { translate: dir === 1 ? 'calc(-100% - 6px) 0px' : 'calc(100% + 6px) 0px' }];
}

/** Incoming parallax: from `dir × factor × width` to rest. */
export function arriveKeyframes(dir: WipeDir, factor: number, width: number): Keyframe[] {
  return [{ translate: `${round(dir * factor * width)}px 0px` }, { translate: '0px 0px' }];
}

/** Starts at 50 % of the run, lasts 42 %, eased out — lands at 92 %. */
export function arriveTiming(duration: number): KeyframeAnimationOptions {
  return {
    delay: round(duration * ARRIVE_START),
    duration: round(duration * ARRIVE_SPAN),
    easing: EASE_OUT_QUAD,
    fill: 'backwards',
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

// ---- runners ---------------------------------------------------------------

function run(el: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions): MotionHandle {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return DONE;
  let animation: Animation;
  try {
    animation = (el as HTMLElement).animate(keyframes, options);
  } catch {
    return DONE; // e.g. an easing string this browser cannot parse
  }
  const finished = animation.finished.then(() => undefined, () => undefined);
  return {
    finished,
    finish: () => { try { animation.finish(); } catch { /* already gone */ } },
    cancel: () => animation.cancel(),
  };
}

export interface WipeOptions { dir: WipeDir; duration?: number }

/** Covers `el` (the leaving layer) with the measured curve. The caller hides it when `finished` resolves. */
export function wipe(el: Element | null | undefined, { dir, duration = DUR.wipeHero }: WipeOptions): MotionHandle {
  return run(el, wipeKeyframes(dir), { duration, easing: WIPE_EASING(), fill: 'forwards' });
}

/** Uncovers `el` (an incoming layer) in step with a wipe of the same direction. */
export function reveal(el: Element | null | undefined, { dir, duration = DUR.wipeHero }: WipeOptions): MotionHandle {
  return run(el, revealKeyframes(dir), { duration, easing: WIPE_EASING(), fill: 'none' });
}

export interface TravelOptions extends WipeOptions { width: number }

/** Drifts the leaving content away, locked to the wipe. */
export function drift(el: Element | null | undefined, { dir, width, duration = DUR.wipeHero }: TravelOptions): MotionHandle {
  return run(el, driftKeyframes(dir, width), { duration, easing: WIPE_EASING(), fill: 'forwards' });
}

/** Slides a flat colour panel (with its attached edge) out along the wipe curve. */
export function sweep(el: Element | null | undefined, { dir, duration = DUR.wipeHero }: WipeOptions): MotionHandle {
  return run(el, sweepKeyframes(dir), { duration, easing: WIPE_EASING(), fill: 'forwards' });
}

export interface ArriveOptions extends TravelOptions { factor: number }

/** Parallax arrival of one incoming layer. */
export function arrive(el: Element | null | undefined, { dir, factor, width, duration = DUR.wipeHero }: ArriveOptions): MotionHandle {
  return run(el, arriveKeyframes(dir, factor, width), arriveTiming(duration));
}

/** Bundle several handles so a caller can finish/cancel a whole gesture at once. */
export function group(handles: MotionHandle[]): MotionHandle {
  return {
    finished: Promise.all(handles.map((h) => h.finished)).then(() => undefined),
    finish: () => handles.forEach((h) => h.finish()),
    cancel: () => handles.forEach((h) => h.cancel()),
  };
}
