import { Injectable, inject, signal } from '@angular/core';
import { ProgressStore } from '../motion/progress-store';

/** What a cook has ticked off for one recipe, on this device. */
export interface RecipeChecks {
  ingredients: number[];
  steps: number[];
}

const EMPTY: RecipeChecks = { ingredients: [], steps: [] };
const CHECKS = 'checks';
const COOK = 'cook';

export interface CookPosition { step: number; total: number; name?: string }

/**
 * Per-recipe progress: checked ingredients, done method steps and the Cook
 * Mode position. Backed by ProgressStore (versioned localStorage keys, 14-day
 * pruning, in-memory when storage is blocked) and exposed as signals so the
 * detail page and Cook Mode always agree.
 */
@Injectable({ providedIn: 'root' })
export class RecipeProgress {
  private readonly store = inject(ProgressStore);
  private readonly cache = signal<Record<string, RecipeChecks>>({});

  checks(recipeId: string): RecipeChecks {
    const cached = this.cache()[recipeId];
    if (cached) return cached;
    const stored = this.store.get<RecipeChecks>(CHECKS, recipeId);
    return stored && Array.isArray(stored.ingredients) && Array.isArray(stored.steps) ? stored : EMPTY;
  }

  isChecked(recipeId: string, kind: keyof RecipeChecks, index: number): boolean {
    return this.checks(recipeId)[kind].includes(index);
  }

  toggle(recipeId: string, kind: keyof RecipeChecks, index: number): void {
    if (!recipeId) return;
    const current = this.checks(recipeId);
    const list = current[kind];
    const next: RecipeChecks = { ...current, [kind]: list.includes(index) ? list.filter((i) => i !== index) : [...list, index].sort((a, b) => a - b) };
    this.write(recipeId, next);
  }

  reset(recipeId: string, kind?: keyof RecipeChecks): void {
    const current = this.checks(recipeId);
    this.write(recipeId, kind ? { ...current, [kind]: [] } : EMPTY);
  }

  hasAny(recipeId: string): boolean {
    const { ingredients, steps } = this.checks(recipeId);
    return ingredients.length + steps.length > 0;
  }

  cookPosition(recipeId: string): CookPosition | null {
    const stored = this.store.get<CookPosition>(COOK, recipeId);
    return stored && typeof stored.step === 'number' && typeof stored.total === 'number' ? stored : null;
  }

  setCookPosition(recipeId: string, position: CookPosition): void {
    if (recipeId) this.store.set(COOK, recipeId, position);
  }

  /** The most recent Cook Mode session (for "Continue cooking"), or null. */
  latestCook(): { id: string; position: CookPosition } | null {
    const [latest] = this.store.list<CookPosition>(COOK);
    return latest && typeof latest.value?.step === 'number' ? { id: latest.id, position: latest.value } : null;
  }

  private write(recipeId: string, value: RecipeChecks) {
    this.cache.update((all) => ({ ...all, [recipeId]: value }));
    if (value.ingredients.length || value.steps.length) this.store.set(CHECKS, recipeId, value);
    else this.store.remove(CHECKS, recipeId);
  }
}
