import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImgFallback, PLATE_SRC } from '../../directives/img-fallback';
import { RecipeModel } from '../../models/recipe-model';
import { recipeMeta } from '../../models/recipe-meta';
import { MotionPrefs } from '../../motion/motion-prefs';
import { armMorph } from '../../motion/route-transition';
import { SPIN_EASING, SPIN_MS, crossings, landingRotation, wheelSet } from '../../motion/spin';

/**
 * "Surprise me": a lazy-Susan of recipes from the currently visible set spins
 * and stops on one. The winner is picked first, then the wheel is animated to
 * it — so it can never land anywhere else. Lazy-loaded; native <dialog>.
 */
@Component({
  selector: 'app-spin-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ImgFallback],
  templateUrl: './spin-overlay.html',
  styleUrl: './spin-overlay.css',
})
export class SpinOverlay {
  /** The recipes currently on screen (after filters and search). */
  readonly recipes = input<RecipeModel[]>([]);
  readonly closed = output<void>();

  private readonly prefs = inject(MotionPrefs);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly ring = viewChild<ElementRef<HTMLElement>>('ring');

  protected readonly plate = PLATE_SRC;
  protected readonly pool = computed(() => this.recipes().filter((r) => !!r._id && !!r.name));
  protected readonly wheel = signal<RecipeModel[]>([]);
  protected readonly winner = signal<RecipeModel | null>(null);
  protected readonly phase = signal<'spin' | 'result'>('result');
  protected readonly meta = computed(() => {
    const recipe = this.winner();
    return recipe ? recipeMeta(recipe) : [];
  });
  /** Announced politely once the wheel has stopped. */
  protected readonly announcement = signal('');

  private rotation = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private animations: Animation[] = [];

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.spin();
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Pick the winner first, then animate the wheel to it. */
  protected spin() {
    const pool = this.pool();
    if (!pool.length) return;
    this.stop();
    const winner = pool[Math.floor(Math.random() * pool.length)];
    this.winner.set(winner);
    this.announcement.set('');

    // Too few recipes for a wheel, or no motion wanted: just offer the suggestion.
    if (pool.length < 3 || this.prefs.reduced()) return this.reveal();

    const wheel = wheelSet(pool, winner);
    this.wheel.set(wheel);
    this.phase.set('spin');
    this.rotation = 0;
    const turns = 3 + Math.floor(Math.random() * 2);
    const total = landingRotation(wheel.indexOf(winner), wheel.length, turns);
    setTimeout(() => this.animate(total, wheel.length)); // after the wheel has rendered
  }

  private animate(total: number, count: number) {
    const ring = this.ring()?.nativeElement;
    if (!ring || typeof ring.animate !== 'function') return this.reveal();
    const easing = `cubic-bezier(${SPIN_EASING.join(',')})`;
    const timing: KeyframeAnimationOptions = { duration: SPIN_MS, easing, fill: 'forwards' };
    const dishes = Array.from(ring.querySelectorAll<HTMLElement>('.spin__dish'));

    this.animations.push(ring.animate([{ rotate: '0deg' }, { rotate: `${total}deg` }], timing));
    // each photo counter-rotates on the same clock, so the food stays upright
    dishes.forEach((dish) => {
      const img = dish.firstElementChild as HTMLElement;
      this.animations.push(img.animate([{ rotate: '0deg' }, { rotate: `${-total}deg` }], timing));
    });
    // a 60 ms pulse (and a tick of haptics) as each dish passes the marker — all scheduled up front
    for (const { slot, time } of crossings(total, count)) {
      const dish = dishes[slot];
      if (!dish) continue;
      this.animations.push(dish.animate([{ scale: 1 }, { scale: 1.14 }, { scale: 1 }], { duration: 60, delay: Math.max(0, time - 30) }));
      this.timers.push(setTimeout(() => navigator.vibrate?.(8), time));
    }
    this.timers.push(setTimeout(() => this.reveal(), SPIN_MS + 350));
  }

  private reveal() {
    this.phase.set('result');
    const winner = this.winner();
    if (winner) this.announcement.set(`Your surprise recipe: ${winner.name}`);
  }

  private stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.animations.forEach((a) => a.cancel());
    this.animations = [];
  }

  protected close() {
    this.dialog().nativeElement.close();
  }

  /** The dialog was closed (button, Escape, or following the link). Focus returns to the opener natively. */
  protected onClose() {
    this.stop();
    this.closed.emit();
  }

  /** The result photo can fly to the detail page like any tile photo. */
  protected cook(photo: HTMLElement) {
    armMorph(photo, this.winner()?._id);
    this.close();
  }

  /** Clicking the backdrop (the dialog element itself, outside its panel) closes it. */
  protected onBackdrop(event: MouseEvent) {
    if (event.target === this.dialog().nativeElement) this.close();
  }
}
