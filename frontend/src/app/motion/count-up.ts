import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input } from '@angular/core';
import { MotionPrefs } from './motion-prefs';
import { RevealObserver } from './reveal';

export const COUNT_MS = 900;

/** Value shown at `progress` (0–1) of a count-up to `target`: ease-out, whole numbers, exact at the end. */
export function countFrame(target: number, progress: number): number {
  if (!Number.isFinite(target)) return 0;
  const k = Math.min(1, Math.max(0, progress));
  return Math.round(target * (1 - Math.pow(1 - k, 3)));
}

/**
 * `<span appCountUp>{{ value }}</span>` — counts up from 0 once, when it enters view.
 *
 * The real value never leaves the DOM: while counting it is made transparent
 * (so it keeps reserving its final width — no jitter with non-tabular
 * numerals) and the running number is painted over it from a `data-count`
 * attribute via CSS generated content. Tests, assistive tech and a failed
 * script all see the true value.
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUp implements OnInit, OnDestroy {
  /** Stagger, ms. */
  readonly countDelay = input(0);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(MotionPrefs);
  private readonly observer = inject(RevealObserver);
  private readonly zone = inject(NgZone);
  private frame = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    if (this.prefs.reduced() || !this.observer.supported) return;
    this.observer.observe(this.el, () => this.start());
  }

  ngOnDestroy() {
    this.observer.unobserve(this.el);
    cancelAnimationFrame(this.frame);
    if (this.timer) clearTimeout(this.timer);
  }

  private start() {
    const target = Number((this.el.textContent ?? '').trim());
    if (!Number.isFinite(target) || target <= 0) return; // not a plain number: leave it alone
    this.zone.runOutsideAngular(() => {
      this.el.style.setProperty('--count-color', getComputedStyle(this.el).color);
      this.el.dataset['count'] = '0';
      this.el.classList.add('count-up', 'is-counting');
      this.timer = setTimeout(() => {
        const began = performance.now();
        const tick = (now: number) => {
          const progress = (now - began) / COUNT_MS;
          this.el.dataset['count'] = String(countFrame(target, progress));
          if (progress < 1) this.frame = requestAnimationFrame(tick);
          else this.el.classList.remove('is-counting');
        };
        this.frame = requestAnimationFrame(tick);
      }, this.countDelay());
    });
  }
}
