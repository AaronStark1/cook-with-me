import { Component, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Apiservice } from '../../services/apiservice';
import { RouterLink } from '@angular/router';
import { ImgFallback, PLATE_SRC } from '../../directives/img-fallback';
import { Odometer } from '../../components/odometer/odometer';
import { ToastService } from '../../components/toasts/toast.service';
import { Flip } from '../../motion/flip';

@Component({
  selector: 'app-saved-recipes',
  standalone: true,
  imports: [RouterLink, ImgFallback, Odometer, Flip],
  templateUrl: './saved-recipes.html',
  styleUrl: './saved-recipes.css',
})
export class SavedRecipes implements OnInit {

  readonly plate = PLATE_SRC;
  savedRecipes: any[] = [];
  loading = true;
  errorMessage = '';

  private readonly toasts = inject(ToastService);

  constructor(private api: Apiservice) {}

  ngOnInit(): void {
    this.getSavedRecipes();
  }

  getSavedRecipes() {
    this.api.getSavedRecipesAPI().subscribe({
      next: (res: any) => {
        this.savedRecipes = res;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Could not load your collection. Please try again.';
      }
    });
  }

  /** "Try again" after a failed load. */
  retry() {
    this.errorMessage = '';
    this.loading = true;
    this.getSavedRecipes();
  }

  /** `id` is the saved record's `_id` (not the recipe's id). */
  removeRecipe(id: string) {
    this.errorMessage = '';
    const removed = this.savedRecipes.find((recipe) => recipe._id === id);

    this.api.deleteSavedRecipeAPI(id).subscribe({
      // Re-fetch rather than removing optimistically, so the list always
      // reflects what the server actually has. (The tile's exit and the grid
      // closing up are appFlip reacting to that re-rendered list.)
      next: () => {
        this.getSavedRecipes();
        if (removed?.recipeId) this.offerUndo(removed.recipeId, removed.name);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Could not remove the recipe. Please try again.';
      }
    });
  }

  /** A removal has no other confirmation, so it gets a toast with a way back. */
  private offerUndo(recipeId: string, name: string) {
    this.toasts.show(`Removed ${name} from your collection.`, {
      action: { label: 'Undo', run: () => this.restore(recipeId, name) }
    });
  }

  /** Undo = save the recipe again (by its recipe id) and show what the server now has. */
  private restore(recipeId: string, name: string) {
    this.api.saveRecipeAPI(recipeId).subscribe({
      next: () => this.getSavedRecipes(),
      error: (err: HttpErrorResponse) => {
        // 409: it is already back in the collection — just show the real list
        if (err.status === 409) return this.getSavedRecipes();
        this.toasts.error(`Could not put ${name} back. Please try again.`);
      }
    });
  }

}
