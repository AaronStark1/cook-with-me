import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject } from '@angular/core';
import { MotionPrefs } from '../motion/motion-prefs';

/** Only the first rows of a table arrive one after another… */
export const ROWS_IN_COUNT = 10;
/** …and a long table (more than this many rows) does not animate in at all. */
export const ROWS_IN_LIMIT = 50;
/** Mirrors admin-motion.css: 25 ms between rows, 200 ms each. */
export const ROWS_IN_STEP_MS = 25;
export const ROWS_IN_MS = 200;
/** A row whose removal the API has confirmed wipes out for this long before the data drops it. */
export const ROW_OUT_MS = 360;

/**
 * `<tbody appRowsIn>` — the rows present when the table first renders fade/slide in, once.
 *
 * The class that carries the animation is added here at runtime and taken off again when the
 * last row has landed, so rows that appear later (search, refresh) are never animated, and a
 * table without script, with reduced motion or with more than 50 rows is simply there.
 */
@Directive({
  selector: 'tbody[appRowsIn]',
  standalone: true,
})
export class RowsIn implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLTableSectionElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(MotionPrefs);
  private readonly zone = inject(NgZone);
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit() {
    const rows = this.el.rows;
    if (this.prefs.reduced() || !rows.length || rows.length > ROWS_IN_LIMIT) return;

    const staggered = Math.min(rows.length, ROWS_IN_COUNT);
    for (let i = 0; i < staggered; i++) rows[i].style.setProperty('--i', String(i));
    this.el.classList.add('rows-in');

    this.zone.runOutsideAngular(() => {
      this.timer = setTimeout(() => this.el.classList.remove('rows-in'), staggered * ROWS_IN_STEP_MS + ROWS_IN_MS + 50);
    });
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }
}
