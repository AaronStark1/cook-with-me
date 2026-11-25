import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, signal, untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImgFallback, PLATE_SRC } from '../../directives/img-fallback';
import { RecipeModel } from '../../models/recipe-model';
import { Garnish } from '../garnish/garnish';
import { GarnishName } from '../garnish/garnish-glyphs';
import { pickGarnish } from '../garnish/garnish-pick';
import { GhostFit, fitGhostWord, ghostWord, measureWord } from '../../motion/ghost-fit';
import { CursorTag } from '../../motion/cursor-tag';
import { fontsReady } from '../../motion/intro';
import { MotionHandle, WipeDir, arrive, drift, group, reveal, wipe } from '../../motion/wipe';

export interface Dish {
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

/** Parallax arrival factors per layer (ghost word, garnish, foreground props). */
export const LAYER_FACTORS = { word: 0.4, platter: 0.3, dish: 0.15, garnish: 0.55, props: 0.75 } as const;
/** On small screens every factor is scaled so nothing overshoots the viewport. */
export const COMPACT_FACTOR = 0.6;
export const GARNISH_SLOTS = 6;

interface Piece { x: number; y: number; size: number; rot: number; mx: number; my: number; msize: number }
const piece = (x: number, y: number, size: number, rot: number, mx = 0, my = 0, msize = 0): Piece => ({ x, y, size, rot, mx, my, msize });

/**
 * Two arrangements (A/B) that alternate on every change. Positions are the
 * piece centre in cqw of the hero (desktop) / of the stacked stage (mobile:
 * only the first three pieces are shown). Composed by eye so nothing touches
 * the headline, lede, CTAs, info block or controls.
 */
const LAYOUTS: Record<'a' | 'b', { garnish: Piece[]; props: Piece[] }> = {
  a: {
    garnish: [
      piece(65.4, 15.4, 7.4, -18, 10, 15, 17),
      piece(91.8, 39.6, 7.2, 24, 91, 20, 15),
      piece(96, 12, 6.6, 12, 89, 71, 14),
      piece(57.2, 37.4, 6, -32),
      piece(83.5, 5.4, 5.6, 38),
      piece(97.2, 28.2, 5.2, -14),
    ],
    props: [piece(99, 1, 21, 24, 98, 1, 36), piece(38, 52, 18, -20, 2, 82, 34)],
  },
  b: {
    garnish: [
      piece(67.6, 8.4, 6.6, 16, 90, 13, 16),
      piece(89.6, 43.6, 7.6, -22, 8, 22, 15),
      piece(96.6, 18.6, 6.8, 30, 11, 72, 14),
      piece(59.8, 33.8, 6.2, 10),
      piece(91.4, 5.2, 5.6, -34),
      piece(58.4, 20.8, 5, 26),
    ],
    props: [piece(100, 3, 19, -16, 99, 3, 34), piece(36, 52, 19, 28, 3, 81, 36)],
  },
};

/** Out-of-focus foreground props need solid mass to read as a blurred object. */
const PROP_GLYPHS: readonly GarnishName[] = ['tomato', 'lemon', 'egg', 'chilli', 'mushroom', 'garlic', 'basil', 'rosemary'];

/** Stable pseudo-random in [0, 1) from an integer — same bob on every visit and re-render. */
const noise = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** Bob: 3.2–5.0 s, started 0–4 s "ago". */
const bob = (seed: number) => ({ dur: `${(3.2 + noise(seed) * 1.8).toFixed(2)}s`, delay: `${(-noise(seed + 50) * 4).toFixed(2)}s` });

interface Scene { word: string; garnish: GarnishName[]; props: GarnishName[] }
const EMPTY_SCENE: Scene = { word: '', garnish: [], props: [] };
type SlotId = 'a' | 'b';

/**
 * The hero's depth stack: ghost word, platter, dishes, garnish stickers and
 * foreground props. Purely presentational — the carousel owns all state.
 */
@Component({
  selector: 'app-hero-stage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ImgFallback, Garnish, CursorTag],
  templateUrl: './hero-stage.html',
  styleUrl: './hero-stage.css',
})
export class HeroStage {
  readonly dishes = input<Dish[]>([]);
  /** No recipes: show the static plate. */
  readonly empty = input(false);
  readonly recipe = input<RecipeModel | null>(null);
  /** Direction of the latest change (+1 next / −1 previous). */
  readonly dir = input<WipeDir>(1);
  readonly reduced = input(false);
  readonly compact = input(false);
  readonly dragging = input(false);
  /** Duration of one change, ms. */
  readonly duration = input(970);

  protected readonly plate = PLATE_SRC;
  protected readonly slotIds: SlotId[] = ['a', 'b'];
  protected readonly layouts = LAYOUTS;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  private readonly scenes = { a: signal<Scene>(EMPTY_SCENE), b: signal<Scene>(EMPTY_SCENE) };
  protected readonly active = signal<SlotId>('a');
  protected readonly leaving = signal<SlotId | null>(null);
  private readonly fonts = signal(false);
  private shown: RecipeModel | null = null;
  private motion: MotionHandle | null = null;

  protected readonly bobs = {
    a: LAYOUTS.a.garnish.map((_, i) => bob(i + 1)),
    b: LAYOUTS.b.garnish.map((_, i) => bob(i + 21)),
    pa: LAYOUTS.a.props.map((_, i) => bob(i + 41)),
    pb: LAYOUTS.b.props.map((_, i) => bob(i + 61)),
  };

  constructor() {
    fontsReady(3000).then(() => this.fonts.set(true));

    effect(() => {
      const recipe = this.recipe();
      untracked(() => this.show(recipe));
    });
  }

  protected scene(id: SlotId) {
    return this.scenes[id]();
  }

  protected visible(id: SlotId) {
    return this.active() === id || this.leaving() === id;
  }

  /** Ghost-word fit for a slot, as CSS custom properties (cqw-based, so it scales with the poster). */
  protected ghostStyle(id: SlotId): Record<string, string> | null {
    const word = this.scenes[id]().word;
    if (!word || !this.fonts()) return null;
    const metrics = measureWord(word, `'Dela Gothic One'`);
    if (!metrics) return null;
    const fit: GhostFit = fitGhostWord(metrics, this.compact() ? { width: 92, capTarget: 15 } : { width: 62, capTarget: 12.5 });
    return { '--fs': `${fit.size.toFixed(3)}cqw`, '--ls': `${fit.spacing.toFixed(4)}em`, '--cc': fit.capCentre.toFixed(4) };
  }

  private sceneFor(recipe: RecipeModel | null, id: SlotId): Scene {
    if (!recipe) return EMPTY_SCENE;
    const garnish = pickGarnish(recipe.ingredients, GARNISH_SLOTS, id === 'a' ? 0 : 2);
    // props reuse the recipe's own glyphs (never one it does not earn); a herb sprig is always allowed
    const solid = PROP_GLYPHS.filter((name) => garnish.includes(name));
    const props: GarnishName[] = [solid[0] ?? 'rosemary', solid[1] ?? solid[0] ?? 'rosemary'];
    return { word: ghostWord(recipe), garnish, props: id === 'a' ? props : [props[1], props[0]] };
  }

  private show(recipe: RecipeModel | null) {
    if (recipe === this.shown) return;
    const first = this.shown === null;
    this.shown = recipe;
    this.settle();

    if (first || !recipe || this.reduced()) {
      // nothing to travel from (or no motion wanted): swap in place
      this.scenes[this.active()].set(this.sceneFor(recipe, this.active()));
      return;
    }

    const from = this.active();
    const to: SlotId = from === 'a' ? 'b' : 'a';
    this.scenes[to].set(this.sceneFor(recipe, to));
    this.leaving.set(from);
    this.active.set(to);
    const dir = this.dir();
    afterNextRender(() => this.play(from, to, dir), { injector: this.injector });
  }

  /** One change: the old arrangement is wiped away while drifting, the new one is uncovered and settles. */
  private play(from: SlotId, to: SlotId, dir: WipeDir) {
    if (this.leaving() !== from || this.active() !== to) return; // superseded before it started
    const width = this.host.firstElementChild?.clientWidth ?? 0;
    if (!width) return this.settle();
    const duration = this.duration();
    const k = this.compact() ? COMPACT_FACTOR : 1;
    const q = (slot: SlotId, layer: string, part: 'clip' | 'move') =>
      this.host.querySelector(`[data-layer="${layer}"][data-slot="${slot}"]${part === 'move' ? ' > .lyr__move' : ''}`);

    const handles: MotionHandle[] = [];
    for (const [layer, factor] of [['word', LAYER_FACTORS.word], ['garnish', LAYER_FACTORS.garnish], ['props', LAYER_FACTORS.props]] as const) {
      handles.push(
        wipe(q(from, layer, 'clip'), { dir, duration }),
        drift(q(from, layer, 'move'), { dir, width, duration }),
        reveal(q(to, layer, 'clip'), { dir, duration }),
        arrive(q(to, layer, 'move'), { dir, width, duration, factor: factor * k }),
      );
    }
    const motion = (this.motion = group(handles));
    motion.finished.then(() => {
      if (this.motion === motion) this.settle();
    });
  }

  /** Latest wins: drop any in-flight change straight to its end state. */
  private settle() {
    this.motion?.cancel();
    this.motion = null;
    this.leaving.set(null);
  }
}
