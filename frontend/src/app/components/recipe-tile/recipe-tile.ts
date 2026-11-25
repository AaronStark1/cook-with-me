import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImgFallback, PLATE_SRC } from '../../directives/img-fallback';
import { RecipeModel } from '../../models/recipe-model';
import { recipeMeta } from '../../models/recipe-meta';
import { highlightParts } from '../../models/highlight';
import { armMorph } from '../../motion/route-transition';

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
  /** Search text to mark inside the title. */
  readonly highlight = input<string | null>(null);

  protected readonly plate = PLATE_SRC;
  protected readonly meta = computed(() => recipeMeta(this.recipe()));
  protected readonly numeral = computed(() => {
    const i = this.index();
    return i === null ? '' : String(i + 1).padStart(2, '0');
  });
  protected readonly title = computed(() => highlightParts(this.recipe().name, this.highlight()));

  /** Only the clicked tile's photo gets the shared-element name, so it flies to the detail page. */
  protected arm(photo: HTMLElement) {
    armMorph(photo, this.recipe()._id);
  }
}
