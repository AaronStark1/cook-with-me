import { Directive, ElementRef, Injectable, NgZone, OnDestroy, OnInit, inject, input } from '@angular/core';
import { MotionPrefs } from './motion-prefs';

export type RevealVariant = 'rise' | 'mask' | 'wipe' | 'wipe-down' | 'rule' | 'stagger' | 'tile' | 'batch';

/** Children of a `stagger` host delay by index, capped here so long lists never crawl. */
export const STAGGER_CAP = 8;

/** One IntersectionObserver for every reveal in the app. */
@Injectable({ providedIn: 'root' })
export class RevealObserver {
  private readonly zone = inject(NgZone);
  private observer: IntersectionObserver | null = null;
  private readonly callbacks = new WeakMap<Element, () => void>();

  /** False when the platform cannot observe — callers must then leave content visible. */
  readonly supported = typeof IntersectionObserver !== 'undefined';

  observe(el: Element, onEnter: () => void) {
    if (!this.supported) return onEnter();
    this.callbacks.set(el, onEnter);
    this.zone.runOutsideAngular(() => {
      this.observer ??= new IntersectionObserver(
        (entries) => {
          let batch = 0;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            this.observer?.unobserve(entry.target);
            // things that come on screen together (a row of tiles) stagger in arrival order
            if (entry.target.classList.contains('rv--batch')) {
              (entry.target as HTMLElement).style.setProperty('--rv-batch', String(Math.min(batch++, STAGGER_CAP)));
            }
            const callback = this.callbacks.get(entry.target);
            this.callbacks.delete(entry.target);
            callback?.();
          }
        },
        // a little inside the bottom edge, so things start once they are actually on screen
        { rootMargin: '0px 0px -8% 0px', threshold: 0 },
      );
      this.observer.observe(el);
    });
  }

  unobserve(el: Element) {
    this.callbacks.delete(el);
    this.observer?.unobserve(el);
  }
}

/**
 * `<h2 appReveal="mask">` — scroll reveal as progressive enhancement.
 *
 * The hidden state (`.rv`) is only ever added by this directive, at runtime,
 * when motion is allowed and the element can be observed. Without JS, without
 * IntersectionObserver or under reduced motion the element is simply visible.
 *
 * Variants (space-separated, e.g. `appReveal="rise stagger"`):
 *   rise      14 px + fade
 *   mask      rises from behind its own bottom edge (clip-path, no wrapper needed)
 *   wipe      clip from the left          wipe-down  clip from the top
 *   rule      `.rv-rule` lines inside (or the host's kicker rule) draw via scaleX
 *   stagger   direct children get `--i` and delay by index (cap 8)
 *   batch     elements entering together delay by arrival order (cap 8 × 60 ms)
 *   tile      no generic effect — the recipe tile styles its own photo wipe + text rise
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class Reveal implements OnInit, OnDestroy {
  readonly appReveal = input<string>('rise');
  /** Extra delay in ms before this element starts. */
  readonly revealDelay = input<number>(0);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(MotionPrefs);
  private readonly observer = inject(RevealObserver);

  ngOnInit() {
    if (this.prefs.reduced() || !this.observer.supported) return;

    const variants = (this.appReveal() || 'rise').split(/\s+/).filter(Boolean);
    this.el.classList.add('rv', ...variants.map((v) => `rv--${v}`));
    if (this.revealDelay()) this.el.style.setProperty('--rv-delay', `${this.revealDelay()}ms`);
    if (variants.includes('stagger')) this.indexChildren();

    this.observer.observe(this.el, () => {
      // children rendered after init (async data) still get their index
      if (variants.includes('stagger')) this.indexChildren();
      this.el.classList.add('is-in');
    });
  }

  ngOnDestroy() {
    this.observer.unobserve(this.el);
  }

  private indexChildren() {
    Array.from(this.el.children).forEach((child, i) =>
      (child as HTMLElement).style.setProperty('--i', String(Math.min(i, STAGGER_CAP))),
    );
  }
}
