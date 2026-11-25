import { GENERIC_GARNISH, NEUTRAL_GARNISH, garnishFor, matchGarnish, pickGarnish } from './garnish-pick';

describe('garnish selection', () => {
  const pizza = ['Pizza dough', 'Tomato sauce', 'Fresh mozzarella cheese', 'Fresh basil leaves', 'Olive oil', 'Salt and pepper to taste'];

  it('matches glyphs from the recipe\'s own ingredient text', () => {
    expect(matchGarnish(pizza)).toEqual(['tomato', 'basil', 'peppercorn']);
    expect(matchGarnish(['2 cloves garlic, minced', '1 lime', '3 eggs'])).toEqual(['lemon', 'garlic', 'egg']);
    expect(matchGarnish(['Eggplant'])).toEqual([]); // whole words only
    expect(garnishFor('Sesame seeds for garnish')).toBe('sesame');
    expect(garnishFor('Butter')).toBeNull();
  });

  it('never shows an ingredient-specific glyph the recipe does not contain', () => {
    const picked = pickGarnish(pizza, 6);
    expect(picked.length).toBe(6);
    const allowed = new Set([...matchGarnish(pizza), ...NEUTRAL_GARNISH]);
    picked.forEach((name) => expect(allowed.has(name)).toBeTrue());
    expect(picked).toContain('tomato');
    expect(picked).toContain('basil');
  });

  it('falls back to the neutral glyphs when nothing matches', () => {
    pickGarnish(['Butter', 'Flour', 'Sugar'], 5).forEach((name) => expect(NEUTRAL_GARNISH).toContain(name));
  });

  it('uses a generic decorative set only when there is no ingredient data', () => {
    pickGarnish(undefined, 4).forEach((name) => expect(GENERIC_GARNISH).toContain(name));
    expect(pickGarnish([], 3).length).toBe(3);
    expect(pickGarnish(pizza, 0)).toEqual([]);
  });

  it('is deterministic, and the offset gives the B arrangement a different order', () => {
    expect(pickGarnish(pizza, 6)).toEqual(pickGarnish(pizza, 6));
    expect(pickGarnish(pizza, 6, 1)).not.toEqual(pickGarnish(pizza, 6));
    expect([...pickGarnish(pizza, 6, 1)].sort()).toEqual([...pickGarnish(pizza, 6)].sort());
  });
});
