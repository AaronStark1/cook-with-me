/**
 * The app's conservative ingredient-line parsing, ported verbatim from
 * frontend/src/app/models/ingredient.ts so the ticket deal (§7.3) splits a recipe's real
 * ingredients exactly as the Assembly Demo's tickets do. When a line cannot be split with
 * confidence, nothing is guessed: the whole string is the name. A plain ES module (Node and page).
 */

const UNICODE_FRACTIONS = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};
const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join("");

const UNITS = [
  [/^(tablespoons?|tbsps?|tbs)\.?$/i, "TBSP"],
  [/^(teaspoons?|tsps?)\.?$/i, "TSP"],
  [/^cups?$/i, "CUP"],
  [/^(grams?|g)$/i, "G"],
  [/^(kilograms?|kgs?)$/i, "KG"],
  [/^(millilit(er|re)s?|ml)$/i, "ML"],
  [/^(lit(er|re)s?|l)$/i, "L"],
  [/^(ounces?|oz)\.?$/i, "OZ"],
  [/^(pounds?|lbs?)\.?$/i, "LB"],
  [/^cloves?$/i, "CLOVE"],
  [/^slices?$/i, "SLICE"],
  [/^cans?$/i, "CAN"],
  [/^pinch(es)?$/i, "PINCH"],
  [/^sticks?$/i, "STICK"],
  [/^bunch(es)?$/i, "BUNCH"],
  [/^pieces?$/i, "PIECE"],
];

const NUMBER = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?(?:\\s*[${FRACTION_CHARS}])?|[${FRACTION_CHARS}])`;
const LEADING = new RegExp(`^\\s*(${NUMBER})(?:\\s*(?:-|–|to)\\s*(${NUMBER}))?(\\s*)(.*)$`, "i");

export function parseAmount(text) {
  const raw = (text ?? "").trim();
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

export function parseIngredient(line) {
  const text = (line ?? "").trim().replace(/\s+/g, " ");
  const whole = { name: text, quantity: null, amount: null, amountTo: null, unit: null };
  const match = text.match(LEADING);
  if (!match) return whole;

  const [, first, second, gap, remainder] = match;
  const amount = parseAmount(first);
  const amountTo = second ? parseAmount(second) : null;
  if (amount === null || (second && amountTo === null)) return whole;

  let words = remainder.trim().split(" ").filter(Boolean);
  let unit = null;
  if (words.length) {
    const found = UNITS.find(([pattern]) => pattern.test(words[0]));
    if (found) {
      unit = found[1];
      words = words.slice(1);
      if (words[0]?.toLowerCase() === "of") words = words.slice(1);
    }
  }
  const name = words.join(" ").trim();
  if (!name || (!gap && !unit)) return whole;

  const shown = second ? `${first.trim()}–${second.trim()}` : first.trim();
  return { name, quantity: unit ? `${shown} ${unit}` : shown, amount, amountTo, unit };
}

/** For a ticket: name + optional quantity label (models/ingredient.ts splitIngredient). */
export function splitIngredient(line) {
  const { name, quantity } = parseIngredient(line);
  return { name, quantity };
}
