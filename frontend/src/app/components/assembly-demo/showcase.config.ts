import { RecipeModel } from '../../models/recipe-model';

/** How many recipes the Assembly Demo builds on screen. */
export const SHOWCASE_COUNT = 3;

/**
 * Pin specific recipes here (their `_id`s, in order) and they win.
 * Left empty, `pickShowcase` chooses the same three for every visitor.
 */
export const SHOWCASE_RECIPE_IDS: readonly string[] = [];

/** A recipe can be "assembled" only if it really has something to assemble. */
export function isShowcaseEligible(recipe: RecipeModel | null | undefined): recipe is RecipeModel {
  return !!recipe && !!recipe._id && !!recipe.name && !!recipe.image
    && (recipe.ingredients?.length ?? 0) >= 3 && (recipe.instructions?.length ?? 0) >= 3;
}

/**
 * Deterministic pick — no randomness, so every visit shows the same recipes.
 *  1. pinned ids (those that exist and are eligible), in the pinned order;
 *  2. then eligible recipes in API order, in passes that relax one preference at a time:
 *     not in the hero + new cuisine → not in the hero → new cuisine → anything eligible.
 * Hero overlap is therefore only allowed when there are not enough recipes otherwise.
 */
export function pickShowcase(
  recipes: readonly RecipeModel[] | null | undefined,
  heroIds: readonly string[] = [],
  count = SHOWCASE_COUNT,
  pinned: readonly string[] = SHOWCASE_RECIPE_IDS,
): RecipeModel[] {
  const eligible = (recipes ?? []).filter(isShowcaseEligible);
  const picked: RecipeModel[] = [];
  const has = (recipe: RecipeModel) => picked.some((p) => p._id === recipe._id);
  const take = (recipe: RecipeModel) => {
    if (picked.length < count && !has(recipe)) picked.push(recipe);
  };

  for (const id of pinned) {
    const match = eligible.find((r) => r._id === id);
    if (match) take(match);
  }

  const hero = new Set(heroIds);
  const freshCuisine = (recipe: RecipeModel) => !recipe.cuisine || !picked.some((p) => p.cuisine === recipe.cuisine);
  const passes: Array<(recipe: RecipeModel) => boolean> = [
    (r) => !hero.has(r._id!) && freshCuisine(r),
    (r) => !hero.has(r._id!),
    (r) => freshCuisine(r),
    () => true,
  ];
  for (const allow of passes) {
    for (const recipe of eligible) {
      if (picked.length >= count) return picked;
      if (!has(recipe) && allow(recipe)) take(recipe);
    }
  }
  return picked;
}
