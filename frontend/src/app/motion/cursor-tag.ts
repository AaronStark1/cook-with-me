import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input } from '@angular/core';
import { MotionPrefs } from './motion-prefs';

/** How much of the remaining distance the tag covers each frame. */
export const CURSOR_LERP = 0.22;

/** One step of the follow: move `from` a fraction of the way to `to`. */
export function lerpTo(from: number, to: number, k = CURSOR_LERP): number {
  return from + (to - from) * k;
}

/**
 * `<a appCursorTag="View →">` — on fine-pointer devices a small square yolk tag
 * follows the pointer while it is over the host. Decorative only: the host
 * keeps its own accessible name and stays keyboard-focusable. One rAF loop,
 * and only while hovering. Off under reduced motion and on touch.
 */
@Directive({
  selector: '[appCursorTag]',
  standalone: true,
})
export class CursorTag implements OnInit, OnDestroy {
  readonly appCursorTag = input('View →');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(MotionPrefs);
  private readonly zone = inject(NgZone);
  private tag: HTMLElement | null = null;
  private frame = 0;
  private x = 0;
  private y = 0;
  private tx = 0;
  private ty = 0;

  ngOnInit() {
    if (!this.prefs.finePointer()) return;
    this.zone.runOutsideAngular(() => {
      this.el.addEventListener('pointerenter', this.enter, { passive: true });
      this.el.addEventListener('pointermove', this.move, { passive: true });
      this.el.addEventListener('pointerleave', this.leave, { passive: true });
      this.el.addEventListener('pointerdown', this.leave, { passive: true });
    });
  }

  ngOnDestroy() {
    this.el.removeEventListener('pointerenter', this.enter);
    this.el.removeEventListener('pointermove', this.move);
    this.el.removeEventListener('pointerleave', this.leave);
    this.el.removeEventListener('pointerdown', this.leave);
    this.leave();
  }

  private readonly enter = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || this.prefs.reduced() || this.tag) return;
    const tag = (this.tag = document.createElement('span'));
    tag.className = 'cursor-tag';
    tag.setAttribute('aria-hidden', 'true');
    tag.textContent = this.appCursorTag();
    document.body.appendChild(tag);
    this.x = this.tx = event.clientX;
    this.y = this.ty = event.clientY;
    this.place();
    this.frame = requestAnimationFrame(this.tick);
  };

  private readonly move = (event: PointerEvent) => {
    this.tx = event.clientX;
    this.ty = event.clientY;
  };

  private readonly leave = () => {
    cancelAnimationFrame(this.frame);
    this.tag?.remove();
    this.tag = null;
  };

  private readonly tick = () => {
    this.x = lerpTo(this.x, this.tx);
    this.y = lerpTo(this.y, this.ty);
    this.place();
    this.frame = requestAnimationFrame(this.tick);
  };

  private place() {
    if (this.tag) this.tag.style.translate = `${(this.x + 14).toFixed(1)}px ${(this.y + 14).toFixed(1)}px`;
  }
}
