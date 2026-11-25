/** Font metrics of one word, per 1px of font size (i.e. in em). */
export interface WordMetrics {
  /** Ink width of the word at letter-spacing 0. */
  width: number;
  /** Cap height of the face. */
  cap: number;
  /** Font ascent / descent (the line box content area). */
  ascent: number;
  descent: number;
  /** Number of characters (letter-spacing applies to length − 1 gaps). */
  length: number;
}

export interface GhostBox {
  /** Space the word may occupy, in any unit (the result is in the same unit). */
  width: number;
  /** Cap height to aim for when the word is short enough. */
  capTarget: number;
  /** Tightest allowed letter-spacing, in em (negative). */
  minSpacing?: number;
}

export interface GhostFit {
  /** Font size, in the box's unit. */
  size: number;
  /** Letter-spacing in em (≤ 0). */
  spacing: number;
  /** Rendered ink width, in the box's unit. */
  width: number;
  /** Distance from the top of a `line-height: 1` line box to the middle of the caps, in em. */
  capCentre: number;
}

/**
 * Fit a ghost word the way the Blendy reference fits its words: aim for the
 * target cap height; if the word is then too wide, first tighten the
 * letter-spacing (down to `minSpacing`), and only then shrink the type.
 */
export function fitGhostWord(m: WordMetrics, box: GhostBox): GhostFit {
  const minSpacing = box.minSpacing ?? -0.06;
  const gaps = Math.max(0, m.length - 1);
  let size = m.cap > 0 ? box.capTarget / m.cap : box.capTarget;
  let spacing = 0;

  if (m.width * size > box.width && m.width > 0) {
    // tighten: solve (width + gaps × spacing) × size = box.width for spacing
    spacing = gaps ? Math.max(minSpacing, (box.width / size - m.width) / gaps) : 0;
    const tightened = m.width + gaps * spacing;
    if (tightened * size > box.width) size = box.width / tightened;
  }

  const content = m.ascent + m.descent;
  return {
    size,
    spacing,
    width: (m.width + gaps * spacing) * size,
    // line-height 1: the content area is centred in the 1em line box
    capCentre: (1 - content) / 2 + m.ascent - m.cap / 2,
  };
}

/** Ghost word for a recipe: cuisine, else the first meal type, else the first word of the name. */
export function ghostWord(recipe: { cuisine?: string; mealType?: string[]; name?: string } | null | undefined): string {
  const pick = recipe?.cuisine?.trim() || recipe?.mealType?.[0]?.trim() || recipe?.name?.trim().split(/\s+/)[0] || '';
  return pick.toUpperCase();
}

let canvas: HTMLCanvasElement | null = null;
const cache = new Map<string, WordMetrics>();

/** Measure with a canvas at 200px (call after `document.fonts.ready`). Returns null when it cannot be measured. */
export function measureWord(word: string, fontFamily: string): WordMetrics | null {
  const key = `${fontFamily}|${word}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    canvas ??= document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !word) return null;
    const px = 200;
    ctx.font = `400 ${px}px ${fontFamily}`;
    const text = ctx.measureText(word);
    const caps = ctx.measureText('H');
    const width = text.actualBoundingBoxLeft + text.actualBoundingBoxRight;
    const ascent = text.fontBoundingBoxAscent ?? caps.actualBoundingBoxAscent;
    const descent = text.fontBoundingBoxDescent ?? 0;
    if (!(width > 0) || !(caps.actualBoundingBoxAscent > 0)) return null;
    const metrics: WordMetrics = {
      width: width / px,
      cap: caps.actualBoundingBoxAscent / px,
      ascent: ascent / px,
      descent: descent / px,
      length: [...word].length,
    };
    cache.set(key, metrics);
    return metrics;
  } catch {
    return null;
  }
}
