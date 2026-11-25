import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import { Apiservice } from '../../services/apiservice';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

@Component({
  selector: 'app-manage-recipe',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './manage-recipe.html',
  styleUrl: './manage-recipe.css',
})
export class ManageRecipe implements OnInit {

  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly difficulties = DIFFICULTIES;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    cookTimeMinutes: [null as number | null, [Validators.required, Validators.min(0)]],
    prepTimeMinutes: [null as number | null, [Validators.required, Validators.min(0)]],
    servings: [null as number | null, [Validators.required, Validators.min(1)]],
    cuisine: ['', [Validators.required, Validators.maxLength(100)]],
    difficulty: ['', [Validators.required]],
    image: ['', [Validators.required]],
    caloriesPerServing: [null as number | null, [Validators.required, Validators.min(0)]],
  });

  ingredientsArray: string[] = [];
  instructionsArray: string[] = [];
  mealTypeArray: string[] = [];
  cuisineSuggestions: string[] = [];

  recipeId = '';
  submitted = false;
  saving = false;
  loadingRecipe = false;
  errorMessages: string[] = [];

  constructor(
    private api: Apiservice,
    private ar: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.ar.paramMap.pipe(
      map(params => params.get('id') ?? ''),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(id => {
      this.recipeId = id;
      if (id) {
        this.loadRecipe(id);
      }
    });

    this.loadCuisineSuggestions();
  }

  // ==============================
  // LOAD DATA
  // ==============================

  /** Edit mode: fetch just the one recipe being edited. */
  private loadRecipe(id: string) {
    this.loadingRecipe = true;
    this.api.viewRecipeAPI(id).pipe(
      finalize(() => this.loadingRecipe = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (recipe) => {
        this.form.patchValue({
          name: recipe.name ?? '',
          cookTimeMinutes: recipe.cookTimeMinutes ?? null,
          prepTimeMinutes: recipe.prepTimeMinutes ?? null,
          servings: recipe.servings ?? null,
          cuisine: recipe.cuisine ?? '',
          difficulty: this.canonicalDifficulty(recipe.difficulty),
          image: recipe.image ?? '',
          caloriesPerServing: recipe.caloriesPerServing ?? null,
        });
        this.ingredientsArray = [...(recipe.ingredients ?? [])];
        this.instructionsArray = [...(recipe.instructions ?? [])];
        this.mealTypeArray = [...(recipe.mealType ?? [])];
      },
      error: () => {
        this.errorMessages = ['Could not load this recipe. It may have been deleted.'];
      }
    });
  }

  /** Cuisines already in use are only suggestions — admins can type a new one. */
  private loadCuisineSuggestions() {
    this.api.getRecipeAPI().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        const cuisines: string[] = (res.response ?? []).map((r: any) => r.cuisine);
        this.cuisineSuggestions = [...new Set(cuisines)].filter(Boolean);
      },
      error: () => { /* suggestions are optional */ }
    });
  }

  /** Older records may store "easy"/"EASY"; map them onto the select's options. */
  private canonicalDifficulty(value?: string): string {
    return DIFFICULTIES.find(d => d.toLowerCase() === (value ?? '').toLowerCase()) ?? (value ?? '');
  }

  get f() {
    return this.form.controls;
  }

  // ==============================
  // INGREDIENTS / INSTRUCTIONS / MEAL TYPE
  // ==============================

  addIngredients(input: HTMLTextAreaElement) {
    const value = input.value.trim();
    if (value) {
      this.ingredientsArray.push(value);
      input.value = '';
    }
  }

  deleteIngredients(index: number) {
    this.ingredientsArray.splice(index, 1);
  }

  addInstructions(input: HTMLTextAreaElement) {
    const value = input.value.trim();
    if (value) {
      this.instructionsArray.push(value);
      input.value = '';
    }
  }

  deleteInstructions(index: number) {
    this.instructionsArray.splice(index, 1);
  }

  addMeal(input: HTMLInputElement) {
    const value = input.value.trim();
    if (value && !this.mealTypeArray.includes(value)) {
      this.mealTypeArray.push(value);
      input.value = '';
    }
  }

  removeMeal(meal: string) {
    this.mealTypeArray = this.mealTypeArray.filter(item => item !== meal);
  }

  // ==============================
  // SAVE (add or edit)
  // ==============================

  save() {
    this.submitted = true;
    this.errorMessages = [];

    const listsValid = this.ingredientsArray.length > 0 && this.instructionsArray.length > 0 && this.mealTypeArray.length > 0;
    if (this.form.invalid || !listsValid) {
      return;
    }

    const payload = {
      ...this.form.getRawValue(),
      ingredients: this.ingredientsArray,
      instructions: this.instructionsArray,
      mealType: this.mealTypeArray,
    };

    const request$ = this.recipeId
      ? this.api.updateRecipeAPI(this.recipeId, payload)
      : this.api.addRecipeAPI(payload);

    this.saving = true;
    request$.pipe(
      finalize(() => this.saving = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => this.router.navigateByUrl('/admin/recipelist'),
      error: (err: HttpErrorResponse) => {
        const details: { message: string }[] = err.error?.errors ?? [];
        this.errorMessages = details.length
          ? details.map(d => d.message)
          : [err.error?.message || 'Could not save the recipe. Please try again.'];
      }
    });
  }

}
