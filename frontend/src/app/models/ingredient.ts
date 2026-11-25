/**
 * Conservative ingredient-line parsing, shared by the Assembly Demo tickets
 * (name vs quantity) and the servings scaler. When a line cannot be split with
 * confidence, nothing is guessed: the whole string is the name.
 */

export interface ParsedIngredient {
  /** The ingredient itself (the whole line when no quantity was recognised). */
  name: string;
  /** Short quantity label, e.g. "2 TBSP", or null. */
  quantity: string | null;
  /** Numeric amount (the first/only number, or the low end of a range), when one was parsed. */
  amount: number | null;
  /** High end of a range ("1-2 cups" → 2), else null. */
  amountTo: number | null;
  /** Canonical unit label ("TBSP", "CUP"…) or null. */
  unit: string | null;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};
const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');

/** Unit spellings → the label printed on a ticket. */
const UNITS: Array<[RegExp, string]> = [
  [/^(tablespoons?|tbsps?|tbs)\.?$/i, 'TBSP'],
  [/^(teaspoons?|tsps?)\.?$/i, 'TSP'],
  [/^cups?$/i, 'CUP'],
  [/^(grams?|g)$/i, 'G'],
  [/^(kilograms?|kgs?)$/i, 'KG'],
  [/^(millilit(er|re)s?|ml)$/i, 'ML'],
  [/^(lit(er|re)s?|l)$/i, 'L'],
  [/^(ounces?|oz)\.?$/i, 'OZ'],
  [/^(pounds?|lbs?)\.?$/i, 'LB'],
  [/^cloves?$/i, 'CLOVE'],
  [/^slices?$/i, 'SLICE'],
  [/^cans?$/i, 'CAN'],
  [/^pinch(es)?$/i, 'PINCH'],
  [/^sticks?$/i, 'STICK'],
  [/^bunch(es)?$/i, 'BUNCH'],
  [/^pieces?$/i, 'PIECE'],
];

// longest forms first: "1 1/2", then "1/2", then "2", "2.5", "2½", then a lone "½"
const NUMBER = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?(?:\\s*[${FRACTION_CHARS}])?|[${FRACTION_CHARS}])`;
const LEADING = new RegExp(`^\\s*(${NUMBER})(?:\\s*(?:-|–|to)\\s*(${NUMBER}))?(\\s*)(.*)$`, 'i');

/** "1 1/2", "3/4", "½", "2½", "2.5" → number; anything else → null. */
export function parseAmount(text: string | null | undefined): number | null {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  let total = 0;
  let rest = raw;
  const unicode = rest.match(new RegExp(`[${FRACTION_CHARS}]$`));
  if (unicode) {
    total += UNICODE_FRACTIONS[unicode[0]];
    rest = rest.slice(0, -1).trim();
  }
  if (!rest) return total || null;
  const mixed = rest.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return +mixed[3] ? total + +mixed[1] + +mixed[2] / +mixed[3] : null;
  const fraction = rest.match(/^(\d+)\/(\d+)$/);
  if (fraction) return +fraction[2] ? total + +fraction[1] / +fraction[2] : null;
  if (/^\d+(\.\d+)?$/.test(rest)) return total + parseFloat(rest);
  return null;
}

export function parseIngredient(line: string | null | undefined): ParsedIngredient {
  const text = (line ?? '').trim().replace(/\s+/g, ' ');
  const whole: ParsedIngredient = { name: text, quantity: null, amount: null, amountTo: null, unit: null };
  const match = text.match(LEADING);
  if (!match) return whole;

  const [, first, second, gap, remainder] = match;
  const amount = parseAmount(first);
  const amountTo = second ? parseAmount(second) : null;
  if (amount === null || (second && amountTo === null)) return whole;

  let words = remainder.trim().split(' ').filter(Boolean);
  let unit: string | null = null;
  if (words.length) {
    const found = UNITS.find(([pattern]) => pattern.test(words[0]));
    if (found) {
      unit = found[1];
      words = words.slice(1);
      if (words[0]?.toLowerCase() === 'of') words = words.slice(1);
    }
  }
  const name = words.join(' ').trim();
  // a bare number, or a number glued to a word that is not a unit ("7up"), is not a quantity we can trust
  if (!name || (!gap && !unit)) return whole;

  const shown = second ? `${first.trim()}–${second.trim()}` : first.trim();
  return { name, quantity: unit ? `${shown} ${unit}` : shown, amount, amountTo, unit };
}

/** For the Assembly Demo ticket: uppercase-ready name + optional quantity label. */
export function splitIngredient(line: string): { name: string; quantity: string | null } {
  const { name, quantity } = parseIngredient(line);
  return { name, quantity };
}
