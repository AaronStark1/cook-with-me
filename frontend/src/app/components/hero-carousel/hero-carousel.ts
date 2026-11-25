import {
  Component, DestroyRef, ElementRef, HostListener, Injector, NgZone, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecipeModel } from '../../models/recipe-model';
import { recipeMeta } from '../../models/recipe-meta';
import { AuthService } from '../../services/auth';
import { MotionPrefs } from '../../motion/motion-prefs';
import { DUR } from '../../motion/tokens';
import { MotionHandle, WipeDir, sweep } from '../../motion/wipe';
import { claimIntro, fontsReady, playIntro } from '../../motion/intro';
import { Dish, HeroStage } from '../hero-stage/hero-stage';
import { HeroInfo } from '../hero-info/hero-info';

/** Most dishes riding the platter at once. */
export const MAX_FEATURED = 5;
/** Time each dish stays in the focal position while auto-advancing. */
export const AUTOPLAY_MS = 5200;
/** Any user action holds the rotation this long before autoplay resumes. */
export const USER_PAUSE_MS = 6000;
/** Autoplay stops when less than this share of the hero is on screen. */
export const MIN_VISIBLE = 0.3;
/**
 * Hero field colours. Cream text (#FFF3E0) on each is ≥ 5:1, so the headline
 * stays legible on both sides of the wipe (tomato, paprika, beet, basil).
 */
export const FIELD_COLORS = ['#C8281C', '#B4410E', '#9B1B3C', '#2F5A2E'] as const;

/** A drag becomes a swipe past this horizontal travel (px), when it is mostly horizontal. */
export const SWIPE_PX = 45;
/** Release speed (px/ms) that earns one extra step. */
export const FLICK_SPEED = 0.5;

/** Euclidean modulo. */
const mod = (value: number, size: number) => ((value % size) + size) % size;
/** Signed shortest distance on a ring of `size` slots, in (-size/2, size/2]. */
const wrap = (value: number, size: number) => {
  const v = mod(value, size);
  return v > size / 2 ? v - size : v;
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Whole positions to move when a drag is released.
 * `dx` = horizontal travel (px, negative = dragged left = forward), `dy` = vertical travel,
 * `width` = hero width, `speed` = release speed in px/ms (signed like dx).
 */
export function dragSteps(dx: number, dy: number, width: number, speed: number): number {
  if (!(width > 0)) return 0;
  let steps = Math.round(-dx / (0.5 * width));
  const swipe = Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy);
  if (!steps && swipe) steps = dx < 0 ? 1 : -1;
  // a fast flick carries one position further in its direction
  else if (steps && Math.abs(speed) > FLICK_SPEED && Math.sign(-speed) === Math.sign(steps)) steps += Math.sign(steps);
  return steps;
}

/** Most the focal dish leans towards the pointer, in degrees. */
export const MAX_TILT = 8;

/**
 * Tilt (rotateX, rotateY) for a pointer `dx`, `dy` px from the dish centre: it leans
 * towards the pointer, reaching ±MAX_TILT one dish-width away and never more.
 */
export function tiltFor(dx: number, dy: number, size: number): [number, number] {
  if (!(size > 0)) return [0, 0];
  const clamp = (value: number) => Math.max(-1, Math.min(1, value / size));
  return [-clamp(dy) * MAX_TILT, clamp(dx) * MAX_TILT];
}

/**
 * Poster hero + "lazy-Susan" recipe carousel.
 *
 * A single `turns` counter is the only moving state: dish positions, platter
 * rotation, active copy, position dots and the field colour are all derived
 * from it, so they can never drift out of sync. A change plays as one 970 ms
 * gesture: the field colour is wiped by a hard edge, the ring turns, and the
 * stage's ghost word, garnish and props travel at their own depths.
 */
@Component({
  selector: 'app-hero-carousel',
  standalone: true,
  imports: [RouterLink, HeroStage, HeroInfo],
  templateUrl: './hero-carousel.html',
  styleUrl: './hero-carousel.css',
})
export class HeroCarousel {
  /** Recipes to feature (the first MAX_FEATURED with a name and id are used). */
  readonly recipes = input<RecipeModel[]>([]);

  protected readonly auth = inject(AuthService);
  private readonly prefs = inject(MotionPrefs);
  private readonly zone = inject(NgZone);
  private readonly injector = inject(Injector);
  protected readonly colors = FIELD_COLORS;
  protected readonly duration = DUR.wipeHero;

  private readonly root = viewChild<ElementRef<HTMLElement>>('hero');

  protected readonly items = computed(() =>
    this.recipes().filter((r) => !!r._id && !!r.name).slice(0, MAX_FEATURED),
  );
  protected readonly count = computed(() => this.items().length);

  /** Unbounded wheel position; +1 = one dish forward. The one source of truth. */
  protected readonly turns = signal(0);
  /** Fractional offset while the platter is being dragged (same unit as `turns`). */
  private readonly drag = signal(0);
  protected readonly dragging = signal(false);
  protected readonly dir = signal<WipeDir>(1);

  protected readonly activeIndex = computed(() => (this.count() ? mod(this.turns(), this.count()) : 0));
  protected readonly activeRecipe = computed(() => this.items()[this.activeIndex()] ?? null);
  protected readonly meta = computed(() => {
    const recipe = this.activeRecipe();
    return recipe ? recipeMeta(recipe) : [];
  });
  protected readonly colorIndex = computed(() => this.activeIndex() % FIELD_COLORS.length);
  /** The colour being wiped away (still on screen, above the new one), or null at rest. */
  protected readonly leavingColor = signal<number | null>(null);
  /** Alternates a/b on every move so the info block's CSS entrance animation replays without recreating DOM. */
  protected readonly swap = computed<'a' | 'b'>(() => (mod(this.turns(), 2) === 0 ? 'a' : 'b'));

  /**
   * Slots on the platter. With fewer than five recipes the ring is filled by
   * repeating the whole set (a multiple of n keeps the order consistent all the
   * way round), so neighbours always peek in.
   */
  private readonly slots = computed(() => {
    const n = this.count();
    if (n <= 1) return n;
    return n >= MAX_FEATURED ? n : n * Math.ceil(MAX_FEATURED / n);
  });
  private readonly step = computed(() => (this.slots() ? 360 / this.slots() : 0));

  /** Rotation of the platter itself (decorative rings turn with the dishes). */
  protected readonly wheel = computed(() => -(this.turns() + this.drag()) * this.step());

  protected readonly dishes = computed<Dish[]>(() => {
    const items = this.items();
    const n = items.length;
    const slots = this.slots();
    if (!n) return [];
    const step = this.step();
    const turns = this.turns();
    const position = turns + this.drag();

    return Array.from({ length: slots }, (_, slot) => {
      const rel = slots === 1 ? 0 : wrap(slot - turns, slots);
      // fractional while dragging, so size and visibility follow the hand
      const distance = slots === 1 ? 0 : Math.abs(wrap(slot - position, slots));
      return {
        slot,
        recipe: items[slot % n],
        theta: (slot - position) * step,
        rel,
        scale: distance <= 1 ? lerp(1, 0.56, distance) : lerp(0.56, 0.4, Math.min(1, distance - 1)),
        opacity: distance <= 1 ? 1 : Math.max(0, 2 - distance),
        z: 20 - Math.round(distance) * 2,
      };
    });
  });

  // ---- layout mode ---------------------------------------------------------
  /** The stacked small-screen composition (matches the 820px container query). */
  protected readonly compact = signal(false);

  // ---- autoplay gating -------------------------------------------------
  protected readonly reduced = this.prefs.reduced;
  protected readonly userPaused = signal(false);
  private readonly hovered = signal(false);
  private readonly focused = signal(false);
  private readonly tabHidden = signal(typeof document !== 'undefined' && document.hidden);
  /** At least MIN_VISIBLE of the hero is in the viewport. */
  private readonly inView = signal(true);

  protected readonly canAutoplay = computed(
    () =>
      this.count() > 1 &&
      !this.reduced() &&
      !this.userPaused() &&
      !this.hovered() &&
      !this.focused() &&
      !this.tabHidden() &&
      !this.dragging() &&
      this.inView(),
  );
  /** Idle loops (bob) only run while the hero is on screen in a visible tab. */
  protected readonly idle = computed(() => this.tabHidden() || !this.inView());

  /** Length of the current countdown: AUTOPLAY_MS, or USER_PAUSE_MS after a user action. */
  protected readonly cycleMs = signal(AUTOPLAY_MS);
  private remaining = AUTOPLAY_MS;
  private countedTurn = 0;
  private holdNext = false;

  /** Polite status text — only filled for user-initiated changes, never for autoplay. */
  protected readonly announcement = signal('');

  private fieldMotion: MotionHandle | null = null;
  private shownColor = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // The single timer. The countdown restarts on every position change (6 s after a user action,
    // 5.2 s otherwise), freezes while autoplay is not allowed and picks up where it left off.
    effect((onCleanup) => {
      const turn = this.turns();
      const allowed = this.canAutoplay();
      if (turn !== this.countedTurn) {
        this.countedTurn = turn;
        this.remaining = this.holdNext ? USER_PAUSE_MS : AUTOPLAY_MS;
        this.holdNext = false;
        untracked(() => this.cycleMs.set(this.remaining));
      }
      if (!allowed) return;
      const started = Date.now();
      const timer = setTimeout(() => this.advance(1, false), this.remaining);
      onCleanup(() => {
        clearTimeout(timer);
        this.remaining = Math.max(0, this.remaining - (Date.now() - started));
      });
    });

    // The field colour follows the active recipe — as a wipe, never a blend.
    effect(() => {
      const next = this.colorIndex();
      this.turns();
      untracked(() => this.changeField(next));
    });

    afterNextRender(() => {
      const el = this.root()?.nativeElement;
      if (!el) return;
      this.observe(el, destroyRef);
      this.bindDrag(el, destroyRef);
      this.bindTilt(el, destroyRef);
      this.intro(el);
    });
  }

  /** Move the platter by `delta` dishes. */
  advance(delta: number, byUser = true) {
    if (this.count() < 2 || !delta) return;
    this.dir.set(delta > 0 ? 1 : -1);
    if (byUser) this.holdNext = true;
    this.turns.update((t) => t + delta);
    if (byUser) this.announce();
  }

  /** Jump to recipe `index` by rotating the short way round. */
  goTo(index: number) {
    this.advance(wrap(index - this.activeIndex(), this.count()));
  }

  toggleAutoplay() {
    this.userPaused.update((paused) => !paused);
  }

  // ---- pause on hover / focus / hidden tab ------------------------------
  protected onPointer(event: PointerEvent, inside: boolean) {
    // Touch "hover" sticks after a tap, which would freeze autoplay forever — mouse only.
    if (event.pointerType === 'mouse') this.hovered.set(inside);
  }

  protected onFocusOut(event: FocusEvent, root: HTMLElement) {
    if (!root.contains(event.relatedTarget as Node | null)) this.focused.set(false);
  }

  protected onFocusIn() {
    this.focused.set(true);
  }

  @HostListener('document:visibilitychange')
  protected onVisibility() {
    this.tabHidden.set(document.hidden);
  }

  private announce() {
    const recipe = this.activeRecipe();
    if (recipe) {
      this.announcement.set(`Showing recipe ${this.activeIndex() + 1} of ${this.count()}: ${recipe.name}`);
    }
  }

  // ---- field wipe ------------------------------------------------------------
  private changeField(next: number) {
    const previous = this.shownColor;
    const moved = this.fieldTurn !== this.turns();
    this.fieldTurn = this.turns();
    this.shownColor = next;
    this.settleField();
    if (!moved || this.reduced()) return;

    const dir = this.dir();
    // the old colour rides a single panel that slides off with the yolk edge attached;
    // it runs even when both colours match, so every change has the same sweep
    this.leavingColor.set(previous);
    afterNextRender(
      () => {
        const motion = (this.fieldMotion = sweep(this.root()?.nativeElement.querySelector('.hero__sweep'), { dir, duration: this.duration }));
        motion.finished.then(() => {
          if (this.fieldMotion === motion) this.settleField();
        });
      },
      { injector: this.injector },
    );
  }
  private fieldTurn = 0;

  /** Latest wins: an in-flight wipe drops straight to its end state. */
  private settleField() {
    this.fieldMotion?.cancel();
    this.fieldMotion = null;
    this.leavingColor.set(null);
  }

  // ---- visibility + layout mode ----------------------------------------------
  private observe(el: HTMLElement, destroyRef: DestroyRef) {
    this.compact.set(el.clientWidth <= 820);
    this.zone.runOutsideAngular(() => {
      const cleanups: Array<() => void> = [];
      if (typeof ResizeObserver !== 'undefined') {
        const resize = new ResizeObserver(() => {
          const compact = el.clientWidth <= 820;
          if (compact !== this.compact()) this.compact.set(compact);
        });
        resize.observe(el);
        cleanups.push(() => resize.disconnect());
      }
      if (typeof IntersectionObserver !== 'undefined') {
        const io = new IntersectionObserver(
          ([entry]) => {
            const visible = entry.intersectionRatio >= MIN_VISIBLE;
            if (visible !== this.inView()) this.inView.set(visible);
          },
          { threshold: [0, MIN_VISIBLE, 0.6] },
        );
        io.observe(el);
        cleanups.push(() => io.disconnect());
      }
      destroyRef.onDestroy(() => cleanups.forEach((fn) => fn()));
    });
  }

  // ---- drag / swipe to spin ----------------------------------------------------
  private bindDrag(el: HTMLElement, destroyRef: DestroyRef) {
    const surface = el.querySelector<HTMLElement>('.hero__carousel');
    if (!surface) return;

    let pointer: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastTime = 0;
    let speed = 0;
    let active = false; // true once the gesture is known to be horizontal
    let moved = false;
    let frame = 0;
    let pendingDx = 0;

    const end = (commit: boolean, event?: PointerEvent) => {
      if (pointer === null) return;
      const dx = event ? event.clientX - startX : 0;
      const dy = event ? event.clientY - startY : 0;
      try { surface.releasePointerCapture(pointer); } catch { /* not captured */ }
      pointer = null;
      cancelAnimationFrame(frame);
      if (!active) return;
      active = false;
      const steps = commit ? dragSteps(dx, dy, el.clientWidth, speed) : 0;
      this.zone.run(() => {
        // hand the fractional offset back to `turns` in one write, with transitions back on,
        // so the ring glides from where the hand left it to the snapped position
        this.dragging.set(false);
        this.drag.set(0);
        if (steps) this.advance(steps);
      });
    };

    const onDown = (event: PointerEvent) => {
      if (this.count() < 2 || pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const target = event.target as HTMLElement;
      if (!target.closest('.hero__disc, .dish')) return;
      pointer = event.pointerId;
      startX = lastX = event.clientX;
      startY = event.clientY;
      lastTime = event.timeStamp;
      speed = 0;
      active = false;
      moved = false;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!active) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          pointer = null; // first movement is vertical: this is a page scroll, not a spin
          return;
        }
        active = moved = true;
        try { surface.setPointerCapture(event.pointerId); } catch { /* ignore */ }
        this.zone.run(() => this.dragging.set(true));
      }
      const dt = event.timeStamp - lastTime;
      if (dt > 0) speed = lerp(speed, (event.clientX - lastX) / dt, 0.5);
      lastX = event.clientX;
      lastTime = event.timeStamp;
      pendingDx = dx;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = el.clientWidth || 1;
        this.drag.set(-pendingDx / (0.5 * width));
      });
    };

    const onUp = (event: PointerEvent) => event.pointerId === pointer && end(true, event);
    const onCancel = (event: PointerEvent) => event.pointerId === pointer && end(false);
    // never follow the dish link at the end of a drag
    const onClick = (event: MouseEvent) => {
      if (!moved) return;
      moved = false;
      event.preventDefault();
      event.stopPropagation();
    };

    this.zone.runOutsideAngular(() => {
      surface.addEventListener('pointerdown', onDown, { passive: true });
      surface.addEventListener('pointermove', onMove, { passive: true });
      surface.addEventListener('pointerup', onUp, { passive: true });
      surface.addEventListener('pointercancel', onCancel, { passive: true });
      surface.addEventListener('click', onClick, true);
    });
    destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      surface.removeEventListener('pointerdown', onDown);
      surface.removeEventListener('pointermove', onMove);
      surface.removeEventListener('pointerup', onUp);
      surface.removeEventListener('pointercancel', onCancel);
      surface.removeEventListener('click', onClick, true);
    });
  }

  // ---- pointer tilt (fine pointers; off under reduced motion and while dragging) --------
  private bindTilt(el: HTMLElement, destroyRef: DestroyRef) {
    if (!this.prefs.finePointer()) return;
    let frame = 0;
    let px = 0;
    let py = 0;
    const flat = () => {
      cancelAnimationFrame(frame);
      el.style.removeProperty('--tilt-x');
      el.style.removeProperty('--tilt-y');
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || this.reduced() || this.dragging()) return flat();
      px = event.clientX;
      py = event.clientY;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const dish = el.querySelector<HTMLElement>('.dish.is-active');
        if (!dish) return;
        const rect = dish.getBoundingClientRect();
        const [tiltX, tiltY] = tiltFor(px - (rect.left + rect.width / 2), py - (rect.top + rect.height / 2), rect.width);
        el.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
        el.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
      });
    };
    this.zone.runOutsideAngular(() => {
      el.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerleave', flat, { passive: true });
    });
    destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', flat);
    });
  }

  // ---- opening sequence --------------------------------------------------------
  /** Starts the once-per-session intro when the fonts and the first dish are ready (≤ 600 ms). */
  private intro(el: HTMLElement) {
    if (!claimIntro()) return;
    const started = Date.now();
    const firstImage = (): Promise<void> =>
      new Promise((resolve) => {
        const check = () => {
          const img = el.querySelector<HTMLImageElement>('.dish.is-active img');
          if ((img && img.complete) || Date.now() - started > 600) return resolve();
          setTimeout(check, 50);
        };
        check();
      });
    this.zone.runOutsideAngular(() => {
      Promise.all([fontsReady(600), firstImage()]).then(playIntro);
    });
  }
}
