import { RecipeModel } from './recipe-model';

/** Prep + cook time in minutes, or null when the record has neither. */
export function totalMinutes(recipe: RecipeModel): number | null {
  const prep = recipe.prepTimeMinutes;
  const cook = recipe.cookTimeMinutes;
  const hasTime = typeof prep === 'number' || typeof cook === 'number';
  const sum = (typeof prep === 'number' ? prep : 0) + (typeof cook === 'number' ? cook : 0);
  return hasTime && sum > 0 ? sum : null;
}

/**
 * Short metadata line items (cuisine, first meal type, time, difficulty).
 * Only fields that really exist on the record are returned — nothing is invented.
 */
export function recipeMeta(recipe: RecipeModel): string[] {
  const items: string[] = [];
  if (recipe.cuisine) items.push(recipe.cuisine);
  const meal = recipe.mealType?.[0];
  if (meal) items.push(meal);
  const minutes = totalMinutes(recipe);
  if (minutes) items.push(`${minutes} min`);
  if (recipe.difficulty) items.push(recipe.difficulty);
  return items;
}
