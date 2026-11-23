import { Component, OnInit } from '@angular/core';
import { Apiservice } from '../../services/apiservice';
import { RouterLink } from '@angular/router';
import { ImgFallback, PLATE_SRC } from '../../directives/img-fallback';

@Component({
  selector: 'app-saved-recipes',
  standalone: true,
  imports: [RouterLink, ImgFallback],
  templateUrl: './saved-recipes.html',
  styleUrl: './saved-recipes.css',
})
export class SavedRecipes implements OnInit {

  readonly plate = PLATE_SRC;
  savedRecipes: any[] = [];
  loading = true;
  errorMessage = '';

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

  removeRecipe(id: string) {
    this.errorMessage = '';

    this.api.deleteSavedRecipeAPI(id).subscribe({
      // Re-fetch rather than removing optimistically, so the list always
      // reflects what the server actually has.
      next: () => this.getSavedRecipes(),
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Could not remove the recipe. Please try again.';
      }
    });
  }

}
