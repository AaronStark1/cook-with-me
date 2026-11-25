import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject } from '@angular/core';
import { MotionPrefs } from './motion-prefs';
import { EASE, EASE_ARRIVE, WIPE_EASING } from './tokens';

export const FLIP_MS = 420;
export const FLIP_STAGGER_MS = 18;
/** Only the first N moving items animate; the rest are simply in place. */
export const FLIP_CAP = 12;
export const FLIP_LEAVE_MS = 260;

export interface Point { left: number; top: number }
interface Box extends Point { width: number; height: number }
/** Marks a removed child that is only on screen to finish its exit. */
const GHOST = 'data-flip-leaving';
export interface FlipMove<K> { key: K; dx: number; dy: number; delay: number }

/**
 * Pure FLIP maths: which surviving items moved, by how much (from where they
 * were to where they are now), with an 18 ms stagger capped at 12 items.
 * Items missing from `before` are new; they are returned by `flipEntering`.
 */
export function flipMoves<K>(before: Map<K, Point>, after: Map<K, Point>, cap = FLIP_CAP): FlipMove<K>[] {
  const moves: FlipMove<K>[] = [];
  for (const [key, now] of after) {
    const was = before.get(key);
    if (!was) continue;
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    if (moves.length >= cap) break;
    moves.push({ key, dx, dy, delay: moves.length * FLIP_STAGGER_MS });
  }
  return moves;
}

export function flipEntering<K>(before: Map<K, Point>, after: Map<K, Point>): K[] {
  return [...after.keys()].filter((key) => !before.has(key));
}

/**
 * `<ul appFlip>` — when the list's children change, the survivors glide to
 * their new grid positions (FLIP, WAAPI), new children rise in, and removed
 * children are clip-wiped away.
 *
 * Leaving items are handled without holding up Angular's own DOM: the moment a
 * child is removed, the detached node is put back as an inert, aria-hidden
 * "ghost", pinned where it last stood, wiped out and then dropped. The list
 * Angular renders is therefore always exactly the data (assistive tech and
 * tests never see a stale item), and the grid closes up immediately.
 *
 * Nothing animates on first render, and nothing at all under reduced motion.
 * The host must be a positioning context (`position: relative`).
 */
@Directive({
  selector: '[appFlip]',
  standalone: true,
})
export class Flip implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(MotionPrefs);
  private readonly zone = inject(NgZone);

  private positions = new Map<Element, Box>();
  private mutations: MutationObserver | null = null;
  private resize: ResizeObserver | null = null;

  ngAfterViewInit() {
    this.positions = this.measure();
    this.zone.runOutsideAngular(() => {
      if (typeof MutationObserver !== 'undefined') {
        this.mutations = new MutationObserver((records) => this.onMutations(records));
        this.mutations.observe(this.el, { childList: true });
      }
      if (typeof ResizeObserver !== 'undefined') {
        // a resize re-flows the grid: take a fresh snapshot, never animate it
        this.resize = new ResizeObserver(() => (this.positions = this.measure()));
        this.resize.observe(this.el);
      }
    });
  }

  ngOnDestroy() {
    this.mutations?.disconnect();
    this.resize?.disconnect();
  }

  private onMutations(records: MutationRecord[]) {
    const removed: HTMLElement[] = [];
    let real = false;
    for (const record of records) {
      record.removedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement) || node.hasAttribute(GHOST)) return;
        real = true;
        if (this.positions.has(node)) removed.push(node);
      });
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement && !node.hasAttribute(GHOST)) real = true;
      });
    }
    if (!real) return; // only our own ghosts coming and going
    const before = this.positions;
    if (!this.prefs.reduced()) removed.slice(0, FLIP_CAP).forEach((node) => this.ghost(node, before.get(node)!));
    this.play(before);
  }

  /** Put a removed child back as an inert ghost, pinned where it stood, and wipe it out. */
  private ghost(item: HTMLElement, box: Box) {
    if (typeof item.animate !== 'function') return;
    item.setAttribute(GHOST, '');
    item.setAttribute('aria-hidden', 'true');
    item.setAttribute('inert', '');
    Object.assign(item.style, {
      position: 'absolute',
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      margin: '0',
      pointerEvents: 'none',
    });
    this.el.appendChild(item);
    const drop = () => item.remove();
    try {
      item
        .animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 100% 0 0)' }], { duration: FLIP_LEAVE_MS, easing: WIPE_EASING(), fill: 'forwards' })
        .finished.then(drop, drop);
    } catch {
      drop();
    }
  }

  private measure(): Map<Element, Box> {
    const map = new Map<Element, Box>();
    for (const child of Array.from(this.el.children) as HTMLElement[]) {
      if (child.hasAttribute(GHOST)) continue;
      map.set(child, { left: child.offsetLeft, top: child.offsetTop, width: child.offsetWidth, height: child.offsetHeight });
    }
    return map;
  }

  private play(before: Map<Element, Box>) {
    const after = (this.positions = this.measure());
    if (this.prefs.reduced()) return;

    for (const { key, dx, dy, delay } of flipMoves(before, after)) {
      (key as HTMLElement).animate?.(
        [{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }],
        { duration: FLIP_MS, delay, easing: EASE, fill: 'backwards' },
      );
    }
    // new children rise in — unless the whole list is new (first render / back from the empty state)
    if (!before.size) return;
    flipEntering(before, after).slice(0, FLIP_CAP).forEach((key, i) => {
      (key as HTMLElement).animate?.(
        [{ opacity: 0, scale: 0.94, translate: '0px 14px' }, { opacity: 1, scale: 1, translate: '0px 0px' }],
        { duration: 380, delay: 90 + i * FLIP_STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' },
      );
    });
  }
}
