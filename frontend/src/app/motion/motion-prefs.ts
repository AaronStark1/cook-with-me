import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Live `prefers-reduced-motion` state. The only place components read it —
 * they never query the media feature themselves, so the whole app flips
 * together when the OS setting changes mid-session.
 */
@Injectable({ providedIn: 'root' })
export class MotionPrefs {
  private readonly _reduced = signal(false);
  /** True while the user asks for reduced motion. */
  readonly reduced = this._reduced.asReadonly();

  constructor() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._reduced.set(!!query.matches);
    const onChange = (event: MediaQueryListEvent) => this._reduced.set(event.matches);
    query.addEventListener?.('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener?.('change', onChange));
  }

  /** Fine pointer + real hover: the only devices that get cursor-follow effects. */
  finePointer(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && !!window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }
}
