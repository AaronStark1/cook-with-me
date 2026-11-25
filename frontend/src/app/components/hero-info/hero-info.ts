import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecipeModel } from '../../models/recipe-model';
import { Odometer } from '../odometer/odometer';

/**
 * The hero's yolk info block and its broth controls bar. Presentational: every
 * action is emitted to the carousel, which owns the state.
 */
@Component({
  selector: 'app-hero-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Odometer],
  templateUrl: './hero-info.html',
  styleUrl: './hero-info.css',
})
export class HeroInfo {
  readonly recipe = input<RecipeModel | null>(null);
  readonly meta = input<string[]>([]);
  readonly items = input<RecipeModel[]>([]);
  readonly activeIndex = input(0);
  /** Alternates a/b on every move so the rewrite animations replay without recreating DOM. */
  readonly swap = input<'a' | 'b'>('a');
  readonly reduced = input(false);
  readonly userPaused = input(false);
  /** True while the autoplay countdown is actually running. */
  readonly running = input(false);
  /** Length of the current countdown, ms (the active dot fills over it). */
  readonly cycleMs = input(5200);

  readonly step = output<number>();
  readonly pick = output<number>();
  readonly toggle = output<void>();

  protected readonly count = computed(() => this.items().length);
  protected readonly words = computed(() => (this.recipe()?.name ?? '').split(/\s+/).filter(Boolean));
}
