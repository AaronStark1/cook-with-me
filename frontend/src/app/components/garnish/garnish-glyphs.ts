/**
 * Flat garnish "stickers", drawn in a 64 × 64 box.
 *
 * Sticker language (the same as `.photo--offset`): a cream or yolk base
 * silhouette with a broth keyline and a hard broth offset shadow; red and green
 * only ever appear as accents on top of that base, so every glyph reads on all
 * four hero field colours and on the broth platter. Colours are tokens only.
 */
export type GarnishName =
  | 'chilli' | 'basil' | 'lemon' | 'garlic' | 'peppercorn'
  | 'sesame' | 'rosemary' | 'mushroom' | 'tomato' | 'egg';

export type GarnishFill = 'ink' | 'yolk' | 'broth' | 'paper' | 'basil';

export interface GarnishShape {
  d: string;
  fill: GarnishFill;
  /** Part of the silhouette: gets the keyline and casts the offset shadow. */
  base?: boolean;
  /** Optional SVG transform (used to scatter repeated seeds). */
  t?: string;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
const SEED = 'M0-9C5.5-4 5.5 5 0 9C-5.5 5-5.5-4 0-9Z';
const NEEDLE = 'M0-10C3.4-4 3.4 4 0 10C-3.4 4-3.4-4 0-10Z';
const seed = (x: number, y: number, a: number): GarnishShape => ({ d: SEED, fill: 'ink', base: true, t: `translate(${x} ${y}) rotate(${a})` });
const needle = (x: number, y: number, a: number): GarnishShape => ({ d: NEEDLE, fill: 'ink', base: true, t: `translate(${x} ${y}) rotate(${a})` });
const corn = (x: number, y: number): GarnishShape[] => [
  { d: circle(x, y, 10), fill: 'ink', base: true },
  { d: circle(x, y, 7.4), fill: 'broth' },
  { d: `M${x - 4.6} ${y - 1}a4.8 4.8 0 0 1 4-3.8v2.2a2.6 2.6 0 0 0-1.9 1.9Z`, fill: 'ink' },
];

export const GARNISH: Record<GarnishName, GarnishShape[]> = {
  chilli: [
    { d: 'M47 16C54 27 49 45 30 53C21 56.5 12 55 9 50C21 50 31 42 33.5 30C34.5 24 36.5 18 40 13Z', fill: 'yolk', base: true },
    { d: 'M36.5 14C40 8.5 48 9.5 50.5 17.5C45.5 20.5 39.5 19 36.5 14Z', fill: 'basil', base: true },
    { d: 'M44.5 11C45 6.5 48.5 4 53 4.5L53.5 8C51 8 49 9.5 48.5 12Z', fill: 'broth' },
  ],
  basil: [
    { d: 'M31 56C12 49 6 30 13 9C31 14 40 34 31 56Z', fill: 'ink', base: true },
    { d: 'M29.5 49C17 43 13 30 16.5 16.5C28.5 22 34 35 29.5 49Z', fill: 'basil' },
    { d: 'M34 56C35 39 46 28 59 27C60 43 50 54 34 56Z', fill: 'ink', base: true },
    { d: 'M38.5 51C40 41 46.5 33.5 55 31.5C54.5 41.5 48 49 38.5 51Z', fill: 'basil' },
  ],
  lemon: [
    { d: 'M6 38A26 26 0 0 1 58 38Z', fill: 'yolk', base: true },
    { d: 'M12 34.5A20 20 0 0 1 52 34.5Z', fill: 'ink' },
    { d: 'M32 34.5L18.5 21L21.5 18.5Z', fill: 'yolk' },
    { d: 'M32 34.5L30.5 15H33.5Z', fill: 'yolk' },
    { d: 'M32 34.5L42.5 18.5L45.5 21Z', fill: 'yolk' },
  ],
  garlic: [
    { d: 'M32 6C33 16 51 25 49 42C48 52 40 58 32 58C24 58 16 52 15 42C13 25 31 16 32 6Z', fill: 'ink', base: true },
    { d: 'M31 21C26.5 31 26 43 29.5 53H32C29.5 43 30 31 33.5 22Z', fill: 'broth' },
    { d: 'M38.5 29C41 37 40.5 45 37 52H39.5C44 45 44 36 41 29Z', fill: 'broth' },
  ],
  peppercorn: [...corn(21, 24), ...corn(43, 21), ...corn(33, 43)],
  sesame: [seed(15, 17, -30), seed(42, 14, 25), seed(28, 35, 70), seed(51, 38, -15), seed(17, 52, 40), seed(40, 55, -60)],
  rosemary: [
    { d: 'M12 55L50 8L53.5 10.5L15.5 57.5Z', fill: 'yolk', base: true },
    needle(18, 40, -75), needle(30, 46, 10), needle(27, 28, -70), needle(40, 34, 15), needle(37, 17, -65), needle(50, 22, 20),
  ],
  mushroom: [
    { d: 'M7 30C7 14 19 7 32 7C45 7 57 14 57 30C57 34.5 53 36.5 49 36.5H40.5L42.5 52C43 56.5 38.5 59 32 59C25.5 59 21 56.5 21.5 52L23.5 36.5H15C11 36.5 7 34.5 7 30Z', fill: 'ink', base: true },
    { d: 'M13 29.5C15 20 23 14 32 14C41 14 49 20 51 29.5Z', fill: 'yolk' },
    { d: 'M26.5 36.5H37.5L38 41H26Z', fill: 'broth' },
  ],
  tomato: [
    { d: circle(32, 32, 25), fill: 'ink', base: true },
    { d: circle(32, 32, 19.5), fill: 'paper' },
    { d: 'M-2.2 0H2.2V-19.5H-2.2Z', fill: 'ink', t: 'translate(32 32)' },
    { d: 'M-2.2 0H2.2V-19.5H-2.2Z', fill: 'ink', t: 'translate(32 32) rotate(120)' },
    { d: 'M-2.2 0H2.2V-19.5H-2.2Z', fill: 'ink', t: 'translate(32 32) rotate(240)' },
    { d: circle(32, 32, 5.5), fill: 'ink' },
    { d: circle(42, 26.5, 2.6), fill: 'yolk' },
    { d: circle(22, 26.5, 2.6), fill: 'yolk' },
    { d: circle(32, 44, 2.6), fill: 'yolk' },
  ],
  egg: [
    { d: 'M31 7C44 4 57 13 57 27C59 40 51 55 36 57C23 59 8 53 7 38C5 25 14 10 31 7Z', fill: 'ink', base: true },
    { d: circle(33, 31, 11.5), fill: 'yolk', base: true },
    { d: circle(29, 27, 2.4), fill: 'ink' },
  ],
};
