import { GarnishName } from './garnish-glyphs';

/** Glyphs that never claim a specific ingredient — safe on any recipe. */
export const NEUTRAL_GARNISH: readonly GarnishName[] = ['peppercorn', 'sesame', 'rosemary'];

/** Decorative sets used only when a recipe carries no ingredient data at all. */
export const GENERIC_GARNISH: readonly GarnishName[] = ['chilli', 'basil', 'lemon', 'tomato', 'garlic', 'peppercorn', 'egg', 'mushroom'];

/** Ingredient text → the glyph it earns. Order = priority when slots run out. */
const DICTIONARY: ReadonlyArray<[GarnishName, RegExp]> = [
  ['chilli', /\b(chil[li]+(es|s)?|chile(s)?|jalape[nñ]o|cayenne|capsicum|bell peppers?|red pepper flakes|sriracha)\b/i],
  ['tomato', /\btomato(es)?\b/i],
  ['basil', /\b(basil|cilantro|parsley|mint|coriander leaves|herbs?)\b/i],
  ['lemon', /\b(lemons?|limes?)\b/i],
  ['garlic', /\bgarlic\b/i],
  ['mushroom', /\bmushrooms?\b/i],
  ['egg', /\beggs?\b/i],
  ['sesame', /\bsesame\b/i],
  ['rosemary', /\b(rosemary|thyme|oregano)\b/i],
  ['peppercorn', /\b(peppercorns?|black pepper|pepper)\b/i],
];

/** Glyphs the recipe's own ingredient lines justify, in dictionary order. */
export function matchGarnish(ingredients: readonly string[] | null | undefined): GarnishName[] {
  const lines = (ingredients ?? []).filter((line) => typeof line === 'string');
  return DICTIONARY.filter(([, pattern]) => lines.some((line) => pattern.test(line))).map(([name]) => name);
}

/** The single best glyph for one ingredient line, or null (used on Assembly Demo tickets). */
export function garnishFor(ingredient: string): GarnishName | null {
  return DICTIONARY.find(([, pattern]) => pattern.test(ingredient))?.[0] ?? null;
}

/**
 * Fill `slots` garnish positions for a recipe.
 *  · ingredient data present → only glyphs its ingredients mention, leftover
 *    slots (or all of them) filled with the neutral glyphs;
 *  · no ingredient data → a generic decorative set.
 * `offset` rotates the fill so alternating arrangements (A/B) differ.
 */
export function pickGarnish(ingredients: readonly string[] | null | undefined, slots: number, offset = 0): GarnishName[] {
  if (slots <= 0) return [];
  if (!ingredients || !ingredients.length) {
    return Array.from({ length: slots }, (_, i) => GENERIC_GARNISH[(i + offset) % GENERIC_GARNISH.length]);
  }
  const matched = matchGarnish(ingredients).slice(0, slots);
  const neutrals = NEUTRAL_GARNISH.filter((name) => !matched.includes(name));
  const fill = neutrals.length ? neutrals : NEUTRAL_GARNISH;
  const out: GarnishName[] = [...matched];
  for (let i = 0; out.length < slots; i++) out.push(fill[i % fill.length]);
  // rotate, so the A and B arrangements put the same glyphs in different places
  return out.map((_, i) => out[(i + offset) % out.length]);
}
