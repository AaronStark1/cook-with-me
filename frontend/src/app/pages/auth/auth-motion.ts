import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { MotionPrefs } from '../../motion/motion-prefs';

/** Furthest the platter drifts from rest, in px, along the diagonal. */
export const PLATTER_DRIFT_PX = 8;
export const SHAKE_MS = 240;

/** Pointer position (0–1 across the viewport) → platter offset, never further than 8 px from rest. */
export function platterDrift(x: number, y: number, max = PLATTER_DRIFT_PX): { x: number; y: number } {
  const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5)) * 2 - 1;
  const axis = max / Math.SQRT2;
  // truncated (never rounded up), so a corner still lands inside the limit
  const px = (n: number) => Math.trunc(clamp(n) * axis * 100) / 100;
  return { x: px(x), y: px(y) };
}

/**
 * `<div class="auth__platter" appPlatterDrift>` — the decorative platter leans
 * a few pixels towards the pointer. Fine pointers only, never under reduced
 * motion; one passive listener outside the zone, one style write per frame.
 * It only writes `--px` / `--py`; the stylesheet decides what they do.
 */
@Directive({
  selector: '[appPlatterDrift]',
  standalone: true,
})
export class PlatterDrift implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(MotionPrefs);
  private readonly zone = inject(NgZone);
  private frame = 0;
  private listening = false;
  private x = 0.5;
  private y = 0.5;

  private readonly onMove = (event: PointerEvent) => {
    this.x = event.clientX / (window.innerWidth || 1);
    this.y = event.clientY / (window.innerHeight || 1);
    if (this.frame || this.prefs.reduced()) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const drift = platterDrift(this.x, this.y);
      this.el.style.setProperty('--px', `${drift.x}px`);
      this.el.style.setProperty('--py', `${drift.y}px`);
    });
  };

  ngOnInit() {
    if (this.prefs.reduced() || !this.prefs.finePointer()) return;
    this.listening = true;
    this.zone.runOutsideAngular(() => window.addEventListener('pointermove', this.onMove, { passive: true }));
  }

  ngOnDestroy() {
    if (this.listening) window.removeEventListener('pointermove', this.onMove);
    if (this.frame) cancelAnimationFrame(this.frame);
  }
}

/**
 * `<form appShakeInvalid>` — after a submit that leaves fields invalid, those
 * fields (and a show/hide button sitting against them) give one hard
 * three-step shake. It reads the `.is-invalid` state the form already renders
 * and never decides validity itself.
 */
@Directive({
  selector: 'form[appShakeInvalid]',
  standalone: true,
  host: { '(submit)': 'onSubmit()' },
})
export class ShakeInvalid implements OnDestroy {
  private readonly el = inject<ElementRef<HTMLFormElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(MotionPrefs);
  private readonly zone = inject(NgZone);
  private frame = 0;

  protected onSubmit() {
    if (this.prefs.reduced() || this.frame) return;
    // the invalid classes land in the change detection that follows this event
    this.zone.runOutsideAngular(() => {
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.el.querySelectorAll<HTMLElement>('.is-invalid').forEach((field) => {
          const toggle = field.nextElementSibling;
          for (const target of [field, toggle?.matches('.auth__eye') ? toggle : null]) {
            target?.animate?.(
              [{ translate: '-4px 0' }, { translate: '4px 0' }, { translate: '-4px 0' }, { translate: '0 0' }],
              { duration: SHAKE_MS, easing: 'steps(3)' },
            );
          }
        });
      });
    });
  }

  ngOnDestroy() {
    if (this.frame) cancelAnimationFrame(this.frame);
  }
}
