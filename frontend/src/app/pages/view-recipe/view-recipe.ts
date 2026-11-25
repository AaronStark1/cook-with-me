import { Component, DestroyRef, Injector, NgZone, OnInit, ViewContainerRef, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, finalize, map, switchMap, tap } from 'rxjs';
import { Apiservice } from '../../services/apiservice';
import { AuthService } from '../../services/auth';
import { RecipeProgress } from '../../services/recipe-progress';
import { RecipeModel } from '../../models/recipe-model';
import { ImgFallback, PLATE_SRC } from '../../directives/img-fallback';
import { RecipeTile } from '../../components/recipe-tile/recipe-tile';
import { Stamp } from '../../components/stamp/stamp';
import { ToastService } from '../../components/toasts/toast.service';
import { Reveal } from '../../motion/reveal';
import { CountUp } from '../../motion/count-up';
import { BACK, MORPH_PHOTO_NAME, morphTargetId } from '../../motion/route-transition';

type LoadState = 'loading' | 'loaded' | 'error';
interface Notice { type: 'success' | 'info' | 'danger'; text: string }

@Component({
  selector: 'app-view-recipe',
  standalone: true,
  imports: [RouterLink, ImgFallback, RecipeTile, Stamp, Reveal, CountUp],
  templateUrl: './view-recipe.html',
  styleUrl: './view-recipe.css',
})
export class ViewRecipe implements OnInit {

  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ViewContainerRef);
  private readonly zone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly toasts = inject(ToastService);
  protected readonly progress = inject(RecipeProgress);
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

  /** Marks the "Back to recipes" link so the route wipe runs in reverse. */
  protected readonly back = BACK;
  /** Set while this page's photo is the landing spot of a tile photo in flight (shared-element transition). */
  protected morphName: string | null = null;
  /** The save just succeeded: filled bookmark, "Saved", and the stamp. */
  protected saved = false;
  /** Briefly true after a PDF has been generated. */
  protected pdfReady = false;
  /** Index of the method step the reader is on (crossing ~40 % of the viewport), or -1. */
  protected currentStep = -1;
  /** Whether this browser can open a native share sheet (otherwise Share copies the link). */
  protected readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  private stepSpy: IntersectionObserver | null = null;
  private cookOpened = false;

  constructor(
    private ar: ActivatedRoute,
    private router: Router,
    private api: Apiservice,
    protected auth: AuthService
  ) {
    this.destroyRef.onDestroy(() => this.stepSpy?.disconnect());
  }

  ngOnInit(): void {
    this.ar.paramMap.pipe(
      map(params => params.get('id') ?? ''),
      tap(id => {
        this.recipeId = id;
        // A tile hands over the record it already shows (router state), so the page — and the photo a
        // shared-element transition lands on — can render at once. The fresh record still replaces it.
        const preview = this.previewFor(id);
        this.recipe = preview;
        this.relatedRecipes = [];
        this.notice = null;
        this.saved = false;
        this.pdfReady = false;
        this.currentStep = -1;
        this.cookOpened = false;
        this.state = preview ? 'loaded' : 'loading';
        this.landMorph(id);
        if (preview) this.afterRender();
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
      this.afterRender();
    });
  }

  private previewFor(id: string): RecipeModel | null {
    try {
      const candidate = (history.state as { recipe?: RecipeModel } | null)?.recipe;
      return candidate && typeof candidate === 'object' && candidate._id === id && !!candidate.name ? candidate : null;
    } catch {
      return null;
    }
  }

  private landMorph(id: string) {
    if (morphTargetId() !== id) return;
    this.morphName = MORPH_PHOTO_NAME;
    // the name must not outlive the flight, or a later transition would treat the photo as its own layer
    setTimeout(() => (this.morphName = null), 900);
  }

  /**
   * Once the article is in the DOM: watch the method steps, and honour `?cook=1`.
   * (afterNextRender, not a timer: with event coalescing the render that follows an
   * HTTP response happens on the next frame, after any zero-delay timeout.)
   */
  private afterRender() {
    afterNextRender(
      () => {
        this.watchSteps();
        if (!this.cookOpened && this.ar.snapshot?.queryParamMap?.get('cook') === '1' && this.recipe?.instructions?.length) {
          this.startCooking();
        }
      },
      { injector: this.injector },
    );
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

  // ---- progress: check-offs and the current step -------------------------------------
  /** Share of the method the reader has reached (drives the yolk fill of the step rail). */
  protected get rail(): number {
    const total = this.recipe?.instructions?.length ?? 0;
    return total && this.currentStep >= 0 ? (this.currentStep + 1) / total : 0;
  }

  /** The step crossing a line 40 % down the viewport is the "current" one. */
  private watchSteps() {
    this.stepSpy?.disconnect();
    if (typeof IntersectionObserver === 'undefined') return;
    const steps = Array.from(this.host.element.nativeElement.querySelectorAll('.steps li')) as HTMLElement[];
    if (!steps.length) return;
    this.zone.runOutsideAngular(() => {
      this.stepSpy = new IntersectionObserver(
        (entries) => {
          const hit = entries.filter((e) => e.isIntersecting).map((e) => steps.indexOf(e.target as HTMLElement));
          if (!hit.length) return;
          const index = Math.max(...hit);
          if (index !== this.currentStep) this.zone.run(() => (this.currentStep = index));
        },
        { rootMargin: '-40% 0px -59% 0px', threshold: 0 },
      );
      steps.forEach((step) => this.stepSpy!.observe(step));
    });
  }

  // ---- Cook Mode (lazy) -----------------------------------------------------------------
  /** Opens the step-by-step view. Its code is only downloaded here, on demand. */
  async startCooking() {
    const recipe = this.recipe;
    if (!recipe?.instructions?.length || this.cookOpened) return;
    this.cookOpened = true;
    const { CookMode } = await import('../../components/cook-mode/cook-mode');
    if (this.recipe !== recipe) return; // navigated away while loading
    const ref = this.host.createComponent(CookMode);
    ref.setInput('recipe', recipe);
    ref.instance.closed.subscribe(() => {
      ref.destroy();
      this.cookOpened = false;
    });
    ref.instance.save.subscribe(() => this.saveRecipe());
  }

  // ---- share ------------------------------------------------------------------------------
  /** Native share sheet where there is one; otherwise copy the link and say so. */
  async share() {
    const url = typeof location !== 'undefined' ? location.href.split('?')[0] : '';
    if (this.canShare) {
      try {
        await navigator.share({ title: this.recipe?.name ?? 'Recipe', url });
      } catch {
        /* the user closed the sheet — nothing to report */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.toasts.show('Link copied');
    } catch {
      this.toasts.error('Could not copy the link');
    }
  }

  saveRecipe() {
    if (!this.requireLogin()) return;

    this.saving = true;
    this.notice = null;
    this.api.saveRecipeAPI(this.recipeId).pipe(
      finalize(() => this.saving = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.notice = { type: 'success', text: 'Saved to your collection.' };
        this.saved = true;
      },
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
    this.pdfReady = false;
    this.notice = null;
    this.api.addDownloadAPI(this.recipeId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.generatePDF()
          .then(() => {
            this.pdfReady = true;
            setTimeout(() => (this.pdfReady = false), 2200);
          })
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
