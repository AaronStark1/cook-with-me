import { Component, DestroyRef, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImgFallback, PLATE_SRC } from '../../directives/img-fallback';
import { RecipeModel } from '../../models/recipe-model';
import { recipeMeta } from '../../models/recipe-meta';
import { AuthService } from '../../services/auth';

/** Most dishes riding the platter at once. */
export const MAX_FEATURED = 5;
/** Time each dish stays in the focal position while auto-advancing. */
export const AUTOPLAY_MS = 5200;
/**
 * Hero field colours. Cream text (#FFF3E0) on each is ≥ 5:1, so the headline
 * stays legible at every point of the crossfade (tomato, paprika, beet, basil).
 */
export const FIELD_COLORS = ['#C8281C', '#B4410E', '#9B1B3C', '#2F5A2E'] as const;

/** Euclidean modulo. */
const mod = (value: number, size: number) => ((value % size) + size) % size;
/** Signed shortest distance on a ring of `size` slots, in (-size/2, size/2]. */
const wrap = (value: number, size: number) => {
  const v = mod(value, size);
  return v > size / 2 ? v - size : v;
};

interface Dish {
  slot: number;
  recipe: RecipeModel;
  /** Absolute angle on the platter (deg). Continuous — never wraps — so dishes never rewind. */
  theta: number;
  /** Whole positions away from the focal spot (wrapped). 0 = active. */
  rel: number;
  scale: number;
  opacity: number;
  z: number;
}

/**
 * Poster hero + "lazy-Susan" recipe carousel.
 *
 * A single `turns` counter is the only moving state: dish positions, platter
 * rotation, active copy, position dots and the field colour are all derived
 * from it, so they can never drift out of sync. The animation itself is plain
 * CSS transitions on transform/opacity.
 */
@Component({
  selector: 'app-hero-carousel',
  standalone: true,
  imports: [RouterLink, ImgFallback],
  templateUrl: './hero-carousel.html',
  styleUrl: './hero-carousel.css',
})
export class HeroCarousel {
  /** Recipes to feature (the first MAX_FEATURED with a name and id are used). */
  readonly recipes = input<RecipeModel[]>([]);

  protected readonly auth = inject(AuthService);
  protected readonly plate = PLATE_SRC;
  protected readonly colors = FIELD_COLORS;

  protected readonly items = computed(() =>
    this.recipes().filter((r) => !!r._id && !!r.name).slice(0, MAX_FEATURED),
  );
  protected readonly count = computed(() => this.items().length);

  /** Unbounded wheel position; +1 = one dish forward. The one source of truth. */
  protected readonly turns = signal(0);
  protected readonly activeIndex = computed(() => (this.count() ? mod(this.turns(), this.count()) : 0));
  protected readonly activeRecipe = computed(() => this.items()[this.activeIndex()] ?? null);
  protected readonly meta = computed(() => {
    const recipe = this.activeRecipe();
    return recipe ? recipeMeta(recipe) : [];
  });
  protected readonly colorIndex = computed(() => this.activeIndex() % FIELD_COLORS.length);
  /** Alternates a/b on every move so the info block's CSS entrance animation replays without recreating DOM. */
  protected readonly swap = computed(() => (mod(this.turns(), 2) === 0 ? 'a' : 'b'));

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
  protected readonly wheel = computed(() => -this.turns() * this.step());

  protected readonly dishes = computed<Dish[]>(() => {
    const items = this.items();
    const n = items.length;
    const slots = this.slots();
    if (!n) return [];
    const step = this.step();
    const turns = this.turns();

    return Array.from({ length: slots }, (_, slot) => {
      const rel = slots === 1 ? 0 : wrap(slot - turns, slots);
      const distance = Math.abs(rel);
      return {
        slot,
        recipe: items[slot % n],
        theta: (slot - turns) * step,
        rel,
        scale: distance === 0 ? 1 : distance === 1 ? 0.56 : 0.4,
        opacity: distance <= 1 ? 1 : 0,
        z: 20 - distance * 2,
      };
    });
  });

  // ---- autoplay gating -------------------------------------------------
  protected readonly reduced = signal(false);
  protected readonly userPaused = signal(false);
  private readonly hovered = signal(false);
  private readonly focused = signal(false);
  private readonly tabHidden = signal(typeof document !== 'undefined' && document.hidden);

  protected readonly canAutoplay = computed(
    () =>
      this.count() > 1 &&
      !this.reduced() &&
      !this.userPaused() &&
      !this.hovered() &&
      !this.focused() &&
      !this.tabHidden(),
  );

  /** Polite status text — only filled for user-initiated changes, never for autoplay. */
  protected readonly announcement = signal('');

  constructor() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced.set(query.matches);
      const onChange = (event: MediaQueryListEvent) => this.reduced.set(event.matches);
      query.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
    }

    // The single timer. It re-arms after every position change (manual or automatic) and is
    // torn down automatically whenever autoplay is not allowed or the component is destroyed.
    effect((onCleanup) => {
      if (!this.canAutoplay()) return;
      this.turns();
      const timer = setTimeout(() => this.advance(1, false), AUTOPLAY_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  /** Move the platter by `delta` dishes. */
  advance(delta: number, byUser = true) {
    if (this.count() < 2) return;
    this.turns.update((t) => t + delta);
    if (byUser) this.announce();
  }

  /** Jump to recipe `index` by rotating the short way round. */
  goTo(index: number) {
    const delta = wrap(index - this.activeIndex(), this.count());
    if (!delta) return;
    this.turns.update((t) => t + delta);
    this.announce();
  }

  toggleAutoplay() {
    this.userPaused.update((paused) => !paused);
  }

  protected pad(value: number) {
    return String(value).padStart(2, '0');
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
}
