import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject, signal } from '@angular/core';
import { MotionPrefs } from '../../motion/motion-prefs';
import { ScrollState } from '../../motion/scroll-state';

/** Seconds for one full loop at rest. */
export const MARQUEE_SECONDS = 26;

/**
 * Playback rate for a scroll velocity (px/ms): scrolling down speeds the strip
 * up, scrolling up runs it backwards, and it is capped so it never blurs.
 */
export function marqueeRate(velocity: number): number {
  if (!Number.isFinite(velocity) || Math.abs(velocity) < 0.02) return 1;
  const boost = Math.min(5, Math.abs(velocity) * 2.4);
  return velocity > 0 ? 1 + boost : -(1 + boost);
}

/**
 * "Discover ■ Save ■ Cook" as a velocity marquee. The first group is the one
 * real, accessible instance; the second is an aria-hidden copy that only
 * exists to make the loop seamless. Without motion (reduced motion, no WAAPI)
 * it is exactly the static strip it used to be.
 */
@Component({
  selector: 'app-marquee',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="strip__track" [class.is-moving]="moving()">
      <div class="strip__group wrap">
        <p class="strip__word display">Discover</p>
        <span class="strip__mark" aria-hidden="true"></span>
        <p class="strip__word display">Save</p>
        <span class="strip__mark" aria-hidden="true"></span>
        <p class="strip__word display">Cook</p>
        <span class="strip__mark strip__mark--join" aria-hidden="true"></span>
      </div>
      @if (moving()) {
        <div class="strip__group wrap" aria-hidden="true">
          <p class="strip__word display">Discover</p>
          <span class="strip__mark"></span>
          <p class="strip__word display">Save</p>
          <span class="strip__mark"></span>
          <p class="strip__word display">Cook</p>
          <span class="strip__mark strip__mark--join"></span>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; overflow: clip; }
    .strip__track { display: flex; }
    .strip__group {
      display: flex;
      flex: none;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: space-between;
      gap: clamp(0.5rem, 3vw, 2.5rem);
      width: 100%;
    }
    /* three words + two marks always share one line: sized from the viewport, not the container */
    .strip__word { margin: 0; font-size: clamp(0.9rem, 5.2vw, 5.25rem); line-height: 1; white-space: nowrap; }
    .strip__mark { flex: none; width: clamp(0.8rem, 2vw, 1.5rem); height: clamp(0.8rem, 2vw, 1.5rem); background: var(--yolk); }
    .strip__mark--join { display: none; }
    /* moving: each group is a full viewport wide (so two of them loop seamlessly) and gains a joining mark */
    .is-moving .strip__group { width: 100vw; max-width: none; justify-content: space-around; padding-inline: 0; }
    .is-moving .strip__mark--join { display: block; }
  `,
})
export class Marquee {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(MotionPrefs);
  private readonly scroll = inject(ScrollState);
  private readonly zone = inject(NgZone);
  protected readonly moving = signal(false);

  private destroyed = false;
  private teardown: (() => void) | null = null;

  constructor() {
    // registered up front: the animation itself starts a frame later, possibly after the view has gone
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.teardown?.();
    });
    afterNextRender(() => {
      if (this.prefs.reduced() || typeof this.host.animate !== 'function' || typeof IntersectionObserver === 'undefined') return;
      this.moving.set(true);
      // start once the duplicate group has rendered
      requestAnimationFrame(() => this.zone.runOutsideAngular(() => this.run()));
    });
  }

  private run() {
    const track = this.host.querySelector<HTMLElement>('.strip__track');
    if (!track || this.destroyed) return;
    const duration = MARQUEE_SECONDS * 1000;
    const animations: Animation[] = [track.animate([{ translate: '0 0' }, { translate: '-50% 0' }], { duration, iterations: Infinity })];
    // the yolk squares turn a quarter per loop, on the same clock
    track.querySelectorAll<HTMLElement>('.strip__mark').forEach((mark) => {
      animations.push(mark.animate([{ rotate: '0deg' }, { rotate: '90deg' }], { duration, iterations: Infinity }));
    });

    let rate = 1;
    let target = 1;
    let frame = 0;
    let visible = true;
    const apply = () => animations.forEach((a) => (a.playbackRate = rate));
    // ease back to the resting speed; the loop only runs while there is a difference to close
    const ease = () => {
      rate += (target - rate) * 0.08;
      if (Math.abs(target - rate) < 0.01) rate = target;
      apply();
      if (rate !== target) frame = requestAnimationFrame(ease);
      else if (target !== 1) {
        target = 1;
        frame = requestAnimationFrame(ease);
      } else frame = 0;
    };
    const stop = this.scroll.onFrame(({ velocity }) => {
      if (!visible) return;
      const next = marqueeRate(velocity);
      if (next === 1 && target !== 1) return; // let the current burst play out
      target = next;
      if (!frame) frame = requestAnimationFrame(ease);
    });

    // idle loops pause off-screen (and the browser pauses them in hidden tabs)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      animations.forEach((a) => (visible ? a.play() : a.pause()));
    });
    io.observe(this.host);

    this.teardown = () => {
      stop();
      io.disconnect();
      cancelAnimationFrame(frame);
      animations.forEach((a) => a.cancel());
    };
  }
}
