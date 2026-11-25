import { Directive, ElementRef, NgZone, OnDestroy, effect, inject, input } from '@angular/core';
import { countFrame } from '../../motion/count-up';
import { MotionPrefs } from '../../motion/motion-prefs';

/** Admin stays quick: the whole count is one UI beat (the public count-up takes 900 ms). */
export const STAT_COUNT_MS = 200;

/**
 * `<p [appStatCount]="users">{{ users ?? '—' }}</p>` — counts up to the value once, the first
 * time it is a positive number (i.e. when the dashboard data lands).
 *
 * Same contract as the shared `appCountUp`: the real value never leaves the DOM. While counting
 * it is transparent and the running number is painted over it from `data-count` by the global
 * `.count-up` rules, so tests, assistive tech and a failed script all see the true value.
 */
@Directive({
  selector: '[appStatCount]',
  standalone: true,
})
export class StatCount implements OnDestroy {
  readonly appStatCount = input<number | null>(null);
  /** Stagger, ms. */
  readonly countDelay = input(0);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(MotionPrefs);
  private readonly zone = inject(NgZone);
  private started = false;
  private frame = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const target = this.appStatCount();
      if (this.started || this.prefs.reduced() || target == null || !Number.isFinite(target) || target <= 0) return;
      this.started = true;
      const delay = this.countDelay();
      this.zone.runOutsideAngular(() => this.run(target, delay));
    });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.frame);
    if (this.timer) clearTimeout(this.timer);
  }

  private run(target: number, delay: number) {
    const el = this.el;
    el.dataset['count'] = '0';
    el.classList.add('count-up', 'is-counting');
    this.timer = setTimeout(() => {
      const began = performance.now();
      const tick = (now: number) => {
        const progress = (now - began) / STAT_COUNT_MS;
        el.dataset['count'] = String(countFrame(target, progress));
        if (progress < 1) this.frame = requestAnimationFrame(tick);
        else el.classList.remove('is-counting');
      };
      this.frame = requestAnimationFrame(tick);
    }, delay);
  }
}
