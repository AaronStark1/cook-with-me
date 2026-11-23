import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImgFallback, PLATE_SRC } from '../../directives/img-fallback';
import { RecipeModel } from '../../models/recipe-model';
import { recipeMeta } from '../../models/recipe-meta';

/** One recipe in an editorial index: square photo, oversized index numeral, title, metadata. */
@Component({
  selector: 'app-recipe-tile',
  standalone: true,
  imports: [RouterLink, ImgFallback],
  templateUrl: './recipe-tile.html',
  styleUrl: './recipe-tile.css',
})
export class RecipeTile {
  readonly recipe = input.required<RecipeModel>();
  /** Zero-based position, rendered as 01, 02, … */
  readonly index = input<number | null>(null);

  protected readonly plate = PLATE_SRC;
  protected readonly meta = computed(() => recipeMeta(this.recipe()));
  protected readonly numeral = computed(() => {
    const i = this.index();
    return i === null ? '' : String(i + 1).padStart(2, '0');
  });
}
