import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, finalize, map, switchMap, tap } from 'rxjs';
import { Apiservice } from '../../services/apiservice';
import { AuthService } from '../../services/auth';
import { RecipeModel } from '../../models/recipe-model';
import { ImgFallback, PLATE_SRC } from '../../directives/img-fallback';
import { RecipeTile } from '../../components/recipe-tile/recipe-tile';

type LoadState = 'loading' | 'loaded' | 'error';
interface Notice { type: 'success' | 'info' | 'danger'; text: string }

@Component({
  selector: 'app-view-recipe',
  standalone: true,
  imports: [RouterLink, ImgFallback, RecipeTile],
  templateUrl: './view-recipe.html',
  styleUrl: './view-recipe.css',
})
export class ViewRecipe implements OnInit {

  private readonly destroyRef = inject(DestroyRef);
  protected readonly plate = PLATE_SRC;

  recipeId = '';
  // null until loaded, so the template can show loading / error states
  // instead of rendering an empty skeleton.
  recipe: RecipeModel | null = null;
  relatedRecipes: RecipeModel[] = [];
  state: LoadState = 'loading';
  errorMessage = '';
  notice: Notice | null = null;
  saving = false;
  downloading = false;

  constructor(
    private ar: ActivatedRoute,
    private router: Router,
    private api: Apiservice,
    protected auth: AuthService
  ) { }

  ngOnInit(): void {
    this.ar.paramMap.pipe(
      map(params => params.get('id') ?? ''),
      tap(id => {
        this.recipeId = id;
        this.recipe = null;
        this.relatedRecipes = [];
        this.notice = null;
        this.state = 'loading';
      }),
      // switchMap cancels the previous request when the user jumps to a related recipe
      switchMap(id => this.api.viewRecipeAPI(id).pipe(
        catchError((err: HttpErrorResponse) => {
          this.state = 'error';
          this.errorMessage = err.status === 404 || err.status === 400
            ? 'We could not find that recipe.'
            : 'Something went wrong while loading the recipe. Please try again.';
          return EMPTY;
        })
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(recipe => {
      this.recipe = recipe;
      this.state = 'loaded';
      if (recipe.cuisine) {
        this.loadRelated(recipe.cuisine);
      }
    });
  }

  private loadRelated(cuisine: string) {
    this.api.getRelatedRecipeAPI(cuisine)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.relatedRecipes = res.filter(r => r._id !== this.recipeId).slice(0, 4);
        },
        error: () => { this.relatedRecipes = []; } // related recipes are optional
      });
  }

  saveRecipe() {
    if (!this.requireLogin()) return;

    this.saving = true;
    this.notice = null;
    this.api.saveRecipeAPI(this.recipeId).pipe(
      finalize(() => this.saving = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => this.notice = { type: 'success', text: 'Saved to your collection.' },
      error: (err: HttpErrorResponse) => {
        this.notice = err.status === 409
          ? { type: 'info', text: 'This recipe is already in your collection.' }
          : { type: 'danger', text: err.error?.message || 'Could not save the recipe. Please try again.' };
      }
    });
  }

  /** Records the download for the signed-in user, then generates the PDF. */
  downloadRecipe() {
    if (!this.recipe || !this.requireLogin()) return;

    this.downloading = true;
    this.notice = null;
    this.api.addDownloadAPI(this.recipeId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.generatePDF()
          .catch(() => this.notice = { type: 'danger', text: 'Could not generate the PDF.' })
          .finally(() => this.downloading = false);
      },
      error: (err: HttpErrorResponse) => {
        this.downloading = false;
        this.notice = { type: 'danger', text: err.error?.message || 'Could not download the recipe. Please try again.' };
      }
    });
  }

  private async generatePDF() {
    const recipe = this.recipe;
    if (!recipe) return;

    // Loaded on demand: jsPDF is large and only needed when someone downloads.
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);

    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.setTextColor('red');
    pdf.text(recipe.name ?? 'Recipe', 10, 10);
    pdf.setFontSize(12);
    pdf.setTextColor('black');
    pdf.text(`Cuisine : ${recipe.cuisine ?? '-'}`, 10, 20);
    pdf.text(`Servings : ${recipe.servings ?? '-'}`, 10, 25);
    pdf.text(`Difficulty : ${recipe.difficulty ?? '-'}`, 10, 30);
    pdf.text(`Total Preparation Time : ${recipe.prepTimeMinutes ?? '-'} Minutes`, 10, 35);
    pdf.text(`Total Cooking Time : ${recipe.cookTimeMinutes ?? '-'} Minutes`, 10, 40);
    pdf.text(`Calories Per Serving : ${recipe.caloriesPerServing ?? '-'}`, 10, 45);

    // One row per ingredient / step so long lists wrap and paginate properly.
    autoTable(pdf, {
      head: [['#', 'Ingredients Needed']],
      body: (recipe.ingredients ?? []).map((item, i) => [i + 1, item]),
      startY: 50
    });
    const afterIngredients = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50;
    autoTable(pdf, {
      head: [['#', 'Cooking Instructions']],
      body: (recipe.instructions ?? []).map((step, i) => [i + 1, step]),
      startY: afterIngredients + 10
    });

    const fileName = (recipe.name ?? 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    pdf.save(`${fileName || 'recipe'}.pdf`);
  }

  private requireLogin(): boolean {
    if (this.auth.isLoggedIn()) return true;
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
    return false;
  }
}
