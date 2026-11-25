/**
 * Assembly Demo engine + its pure maths.
 *
 * One item's show is a fixed 8 s timeline. Every animated element gets a
 * paused WAAPI animation whose delay is its start on that timeline, so the
 * whole scene is a function of one number: `currentTime`. A *driver* sets it —
 * the scroll driver from scroll progress (continuous, reversible), the player
 * driver by simply letting the animations run.
 */

export type AssemblyPhase = 'set' | 'gather' | 'converge' | 'build' | 'orbit' | 'present';

/** Phase boundaries on one item's timeline, ms. */
export const PHASES: ReadonlyArray<{ phase: AssemblyPhase; label: string; from: number; to: number }> = [
  { phase: 'set', label: 'Setting the plate', from: 0, to: 600 },
  { phase: 'gather', label: 'Gathering the ingredients', from: 600, to: 2600 },
  { phase: 'converge', label: 'Bringing them together', from: 2600, to: 4000 },
  { phase: 'build', label: 'Building the dish', from: 4000, to: 5200 },
  { phase: 'orbit', label: 'Turning the plate', from: 5200, to: 7000 },
  { phase: 'present', label: 'Ready to cook', from: 7000, to: 8000 },
];
export const ITEM_MS = 8000;
/** Scroll driver only: a still stretch at the end of each item, where the plate can be explored. */
export const HOLD_MS = 1400;
/** The §4.2 wipe that carries the next item's colour across. */
export const HANDOFF_MS = 970;

export const at = (phase: AssemblyPhase) => PHASES.find((p) => p.phase === phase)!;

/** Which phase a point on one item's timeline falls in (clamped at both ends). */
export function phaseAt(ms: number): AssemblyPhase {
  if (ms <= 0) return 'set';
  return (PHASES.find((p) => ms < p.to) ?? PHASES[PHASES.length - 1]).phase;
}

export const phaseLabel = (ms: number) => at(phaseAt(ms)).label;

// ---- camera -------------------------------------------------------------------
export interface CameraStop { at: number; x: number; z: number; label: string }
/** The simulated orbit: tilt (rotateX) and turn (rotateZ) at fractions of the Orbit phase. */
export const CAMERA: readonly CameraStop[] = [
  { at: 0, x: 0, z: 0, label: 'Top-down' },
  { at: 0.33, x: 58, z: -28, label: 'Three-quarter' },
  { at: 0.66, x: 66, z: -62, label: 'Low' },
  { at: 1, x: 0, z: -360, label: 'Top-down' },
];
/** The three user-selectable angles (reduced-motion buttons, and a reference for Explore). */
export const ANGLES: ReadonlyArray<{ label: string; x: number; z: number }> = [
  { label: 'Top-down', x: 0, z: 0 },
  { label: 'Three-quarter', x: 58, z: -28 },
  { label: 'Low', x: 66, z: -62 },
];
export const MAX_TILT = 62;

/** The chip label for a point on the item timeline: the stop the camera is at or travelling towards. */
export function angleLabelAt(ms: number): string {
  const orbit = at('orbit');
  if (ms <= orbit.from || ms >= orbit.to) return CAMERA[0].label;
  const k = (ms - orbit.from) / (orbit.to - orbit.from);
  // the label switches halfway between two stops
  let best = CAMERA[0];
  for (const stop of CAMERA) if (Math.abs(stop.at - k) < Math.abs(best.at - k)) best = stop;
  return best.label;
}

// ---- scroll mapping -----------------------------------------------------------
export interface Located {
  /** Item whose timeline is running (or being handed off). */
  item: number;
  /** Position on that item's timeline, 0–ITEM_MS. */
  local: number;
  /** In the still stretch after Present: the plate is explorable. */
  hold: boolean;
  /** Hand-off progress in ms (0–HANDOFF_MS) while the next item wipes in, else null. */
  handoff: number | null;
}

/** Length of the whole scroll-driven show for `count` items. */
export function totalMs(count: number): number {
  return count <= 0 ? 0 : count * (ITEM_MS + HOLD_MS) + (count - 1) * HANDOFF_MS;
}

/** Start of item `index` on the scroll-driven timeline. */
export const itemStart = (index: number) => index * (ITEM_MS + HOLD_MS + HANDOFF_MS);

/** Global time → which item, where on its timeline, and whether it is holding or handing off. */
export function locate(ms: number, count: number): Located {
  if (count <= 0) return { item: 0, local: 0, hold: false, handoff: null };
  const t = Math.min(Math.max(ms, 0), totalMs(count));
  const segment = ITEM_MS + HOLD_MS + HANDOFF_MS;
  const item = Math.min(count - 1, Math.floor(t / segment));
  const into = t - item * segment;
  if (into <= ITEM_MS) return { item, local: into, hold: false, handoff: null };
  if (into <= ITEM_MS + HOLD_MS || item === count - 1) return { item, local: ITEM_MS, hold: true, handoff: null };
  return { item, local: ITEM_MS, hold: false, handoff: into - ITEM_MS - HOLD_MS };
}

// ---- driver selection -----------------------------------------------------------
export type AssemblyDriver = 'scroll' | 'player' | 'static';
/** The exact condition for the pinned scroll driver — home.css uses the same media query for the slot height. */
export const SCROLL_QUERY = '(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

export function driverFor(env: { width: number; finePointer: boolean; reduced: boolean; canObserve: boolean }): AssemblyDriver {
  if (env.reduced || !env.canObserve) return 'static';
  return env.width >= 1024 && env.finePointer ? 'scroll' : 'player';
}

// ---- tickets --------------------------------------------------------------------
export const MAX_TICKETS = 8;
export const MAX_TICKETS_COMPACT = 4;

export interface Tier { name: 'near' | 'mid' | 'far'; scale: number; parallax: number; blur: boolean }
const TIERS: Record<Tier['name'], Tier> = {
  near: { name: 'near', scale: 1.15, parallax: 0.75, blur: true },
  mid: { name: 'mid', scale: 1, parallax: 0.55, blur: false },
  far: { name: 'far', scale: 0.85, parallax: 0.4, blur: false },
};
/** Depth tier by index: near, mid, far, near… — so at most 3 of 8 tickets are near (and blurred). */
export function ticketTier(index: number): Tier {
  return TIERS[(['near', 'mid', 'far'] as const)[index % 3]];
}

export interface Vec { x: number; y: number }

/**
 * Where ticket `index` enters from, in stage units (0–1 on each axis; values
 * outside are off-stage). Edges are used in turn — left, top, right, bottom —
 * and the position along the edge is spread by the golden ratio. No randomness.
 */
export function ticketEntry(index: number): Vec {
  const along = 0.12 + (((index * 0.618034) % 1) * 0.76);
  switch (index % 4) {
    case 0: return { x: -0.22, y: along };
    case 1: return { x: along, y: -0.24 };
    case 2: return { x: 1.22, y: along };
    default: return { x: along, y: 1.24 };
  }
}

/** Angle (deg, clockwise from 12 o'clock) of ticket `index` of `count` around the plate. */
export function ticketAngle(index: number, count: number): number {
  return count > 0 ? (index * 360) / count + 20 : 0;
}

/** A point on a circle of radius `r` around `centre`, at `angle` degrees clockwise from the top. */
export function onCircle(centre: Vec, r: number, angle: number, squash = 1): Vec {
  const a = (angle * Math.PI) / 180;
  return { x: centre.x + Math.sin(a) * r, y: centre.y - Math.cos(a) * r * squash };
}

/** Mid-point of an arc from `a` to `b`, bowed sideways by `bend` × the distance. */
export function arcMid(a: Vec, b: Vec, bend: number): Vec {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { x: (a.x + b.x) / 2 - dy * bend, y: (a.y + b.y) / 2 + dx * bend };
}

/** Tickets shown for a recipe: the first `max`, plus how many more there are. */
export function ticketList<T>(ingredients: readonly T[] | null | undefined, max = MAX_TICKETS): { shown: T[]; more: number } {
  const all = ingredients ?? [];
  return { shown: all.slice(0, max), more: Math.max(0, all.length - max) };
}

// ---- the engine -----------------------------------------------------------------
export interface Track {
  el: Element | null | undefined;
  keyframes: Keyframe[];
  /** Start and length on the item timeline, ms. */
  from: number;
  duration: number;
  easing?: string;
  /** 'both' holds the first frame before and the last frame after (default); 'none' shows only while running. */
  fill?: FillMode;
}

/** A set of paused animations sharing one clock. */
export class AssemblyTimeline {
  private readonly animations: Animation[] = [];
  /** A do-nothing animation spanning the whole timeline: the one honest place to read "now" from. */
  private clock: Animation | null = null;
  private playing = false;

  constructor(tracks: Track[], readonly length = ITEM_MS) {
    for (const track of tracks) {
      const el = track.el as HTMLElement | null | undefined;
      if (!el || typeof el.animate !== 'function') continue;
      try {
        if (!this.clock) {
          this.clock = el.animate([], { duration: length, fill: 'both' });
          this.clock.pause();
        }
        const animation = el.animate(track.keyframes, {
          delay: track.from,
          duration: Math.max(1, track.duration),
          easing: track.easing ?? 'linear',
          fill: track.fill ?? 'both',
        });
        animation.pause();
        this.animations.push(animation);
      } catch {
        /* a keyframe this browser cannot parse: that one element simply stays in its final state */
      }
    }
  }

  /** Number of element tracks (the clock is not counted). */
  get size() {
    return this.animations.length;
  }

  get isPlaying() {
    return this.playing && this.time < this.length;
  }

  /** Current position, ms. */
  get time(): number {
    const value = this.clock?.currentTime;
    return typeof value === 'number' ? Math.min(this.length, Math.max(0, value)) : 0;
  }

  /** Scrub: put every animation at `ms` and hold it there. */
  seek(ms: number) {
    const t = Math.min(Math.max(ms, 0), this.length);
    this.playing = false;
    for (const animation of this.all()) {
      if (animation.playState !== 'paused') animation.pause();
      animation.currentTime = t;
    }
  }

  /** Run from the current position to the end at normal speed. */
  play() {
    const t = this.time;
    if (t >= this.length) return;
    this.playing = true;
    for (const animation of this.all()) {
      animation.currentTime = t;
      // a track that is already over must stay parked on its last frame:
      // play() on a finished animation would rewind it and run it again
      const end = animation.effect?.getComputedTiming().endTime;
      if (typeof end === 'number' && t >= end) continue;
      animation.play();
    }
  }

  pause() {
    this.playing = false;
    const t = this.time;
    for (const animation of this.all()) {
      animation.pause();
      animation.currentTime = t;
    }
  }

  /** Drop every animation: elements return to their natural (assembled) state. */
  destroy() {
    this.playing = false;
    for (const animation of this.all()) animation.cancel();
    this.animations.length = 0;
    this.clock = null;
  }

  private all(): Animation[] {
    return this.clock ? [this.clock, ...this.animations] : this.animations;
  }
}
