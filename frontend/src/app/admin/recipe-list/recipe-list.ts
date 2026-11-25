import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Apiservice } from '../../services/apiservice';
import { SearchPipe } from '../../pipes/search-pipe';
import { ImgFallback } from '../../directives/img-fallback';
import { MotionPrefs } from '../../motion/motion-prefs';
import { ROW_OUT_MS, RowsIn } from '../row-motion';

@Component({
  selector: 'app-recipe-list',
  standalone: true,
  imports: [FormsModule, RouterLink, SearchPipe, ImgFallback, RowsIn],
  templateUrl: './recipe-list.html',
  styleUrl: './recipe-list.css'
})
export class RecipeList implements OnInit, OnDestroy {

  recipes: any[] = [];
  searchKey = '';
  loading = true;
  errorMessage = '';

  /** Rows the API has confirmed deleted and that are wiping out (never set before success). */
  protected readonly leaving = new Set<string>();
  private readonly prefs = inject(MotionPrefs);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private api: Apiservice) {}

  ngOnInit(): void {
    this.getAllRecipes();
  }

  ngOnDestroy(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
  }

  getAllRecipes() {
    this.api.getRecipeAPI().subscribe({
      next: (res: any) => {
        this.recipes = res.response ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Could not load recipes. Please try again.';
      }
    });
  }

  deleteRecipe(id: string) {

    if (this.leaving.has(id)) {
      return; // already deleted, just finishing its wipe
    }

    if (!confirm("Are you sure you want to delete this recipe?")) {
      return;
    }

    this.errorMessage = '';
    this.api.deleteRecipeAPI(id).subscribe({
      next: () => this.removeRow(id),
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Could not delete the recipe.';
      }
    });
  }

  /** Only ever called after the delete succeeded: wipe the row out, then drop it and refresh. */
  private removeRow(id: string) {
    const drop = () => {
      this.leaving.delete(id);
      this.recipes = this.recipes.filter((recipe) => recipe._id !== id);
      // refresh list — once nothing is mid-wipe, so a refresh never cuts another row's exit short
      if (!this.leaving.size) this.getAllRecipes();
    };

    if (this.prefs.reduced()) {
      drop();
      return;
    }

    this.leaving.add(id);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      drop();
    }, ROW_OUT_MS);
    this.timers.add(timer);
  }

}
