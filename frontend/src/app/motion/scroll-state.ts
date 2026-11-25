import { Injectable, NgZone, inject, signal } from '@angular/core';

export interface ScrollFrame {
  /** Scroll offset in px. */
  y: number;
  /** 0–1 through the whole document. */
  progress: number;
  /** +1 scrolling down, −1 up, 0 at rest. */
  direction: 1 | -1 | 0;
  /** px per ms, signed. */
  velocity: number;
}

/**
 * The app's one scroll listener: passive, outside NgZone, rAF-throttled.
 *
 * Per-frame consumers (marquee, scrubbed timelines) subscribe with `onFrame`
 * and write to the DOM directly, so scrolling never triggers change detection.
 * The signals are for coarse state a template may read.
 */
@Injectable({ providedIn: 'root' })
export class ScrollState {
  private readonly zone = inject(NgZone);

  private readonly _y = signal(0);
  private readonly _progress = signal(0);
  private readonly _direction = signal<1 | -1 | 0>(0);
  private readonly _velocity = signal(0);

  readonly y = this._y.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly direction = this._direction.asReadonly();
  readonly velocity = this._velocity.asReadonly();

  private readonly listeners = new Set<(frame: ScrollFrame) => void>();
  private started = false;
  private queued = false;
  private lastY = 0;
  private lastTime = 0;

  /** Subscribe to scroll frames (called outside NgZone). Returns an unsubscribe function. */
  onFrame(listener: (frame: ScrollFrame) => void): () => void {
    this.listeners.add(listener);
    this.start();
    return () => this.listeners.delete(listener);
  }

  /** Start listening (idempotent). Reading the signals does not start it by itself. */
  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.lastY = window.scrollY;
    this.lastTime = performance.now();
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
    });
    this.measure();
  }

  private readonly onScroll = () => {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.measure();
    });
  };

  private measure() {
    const now = performance.now();
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const frame = scrollFrame(y, this.lastY, now - this.lastTime, max);
    this.lastY = y;
    this.lastTime = now;

    this._y.set(frame.y);
    this._progress.set(frame.progress);
    this._direction.set(frame.direction);
    this._velocity.set(frame.velocity);
    this.listeners.forEach((listener) => listener(frame));
  }
}

/** Pure frame maths (unit-tested). */
export function scrollFrame(y: number, lastY: number, dt: number, max: number): ScrollFrame {
  const delta = y - lastY;
  return {
    y,
    progress: max > 0 ? Math.min(1, Math.max(0, y / max)) : 0,
    direction: delta > 0 ? 1 : delta < 0 ? -1 : 0,
    velocity: dt > 0 ? delta / dt : 0,
  };
}
