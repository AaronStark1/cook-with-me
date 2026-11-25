import { RecipeModel } from '../../models/recipe-model';
import { isShowcaseEligible, pickShowcase } from './showcase.config';

const recipe = (n: number, cuisine = `C${n}`, over: Partial<RecipeModel> = {}): RecipeModel => ({
  _id: `id${n}`, name: `Recipe ${n}`, image: `https://x/${n}.jpg`, cuisine,
  ingredients: ['a', 'b', 'c'], instructions: ['1', '2', '3'], ...over,
});
const ids = (list: RecipeModel[]) => list.map((r) => r._id);

describe('pickShowcase', () => {
  it('needs a name, a photo, 3+ ingredients and 3+ steps', () => {
    expect(isShowcaseEligible(recipe(1))).toBeTrue();
    expect(isShowcaseEligible(recipe(1, 'x', { image: '' }))).toBeFalse();
    expect(isShowcaseEligible(recipe(1, 'x', { ingredients: ['a', 'b'] }))).toBeFalse();
    expect(isShowcaseEligible(recipe(1, 'x', { instructions: undefined }))).toBeFalse();
    expect(isShowcaseEligible(recipe(1, 'x', { name: '' }))).toBeFalse();
    expect(isShowcaseEligible(null)).toBeFalse();
  });

  it('is deterministic: the same three for every call', () => {
    const list = Array.from({ length: 12 }, (_, i) => recipe(i + 1));
    const first = ids(pickShowcase(list, ['id1', 'id2', 'id3', 'id4', 'id5']));
    for (let i = 0; i < 5; i++) expect(ids(pickShowcase(list, ['id1', 'id2', 'id3', 'id4', 'id5']))).toEqual(first);
    expect(first).toEqual(['id6', 'id7', 'id8']); // API order, skipping what the hero already features
  });

  it('prefers distinct cuisines', () => {
    const list = [recipe(1, 'Italian'), recipe(2, 'Italian'), recipe(3, 'Thai'), recipe(4, 'Italian'), recipe(5, 'Mexican')];
    expect(ids(pickShowcase(list))).toEqual(['id1', 'id3', 'id5']);
  });

  it('allows hero overlap only when there are not enough recipes otherwise', () => {
    const list = [recipe(1), recipe(2), recipe(3), recipe(4)];
    expect(ids(pickShowcase(list, ['id1', 'id2', 'id3']))).toEqual(['id4', 'id1', 'id2']);
    expect(ids(pickShowcase(list, ['id1']))).toEqual(['id2', 'id3', 'id4']);
  });

  it('repeats a cuisine rather than fall back on the hero', () => {
    const list = [recipe(1, 'Italian'), recipe(2, 'Italian'), recipe(3, 'Italian'), recipe(4, 'Italian')];
    expect(ids(pickShowcase(list, ['id1']))).toEqual(['id2', 'id3', 'id4']);
  });

  it('handles 0, 1 and 2 eligible recipes, and skips ineligible ones', () => {
    expect(pickShowcase([])).toEqual([]);
    expect(pickShowcase(null)).toEqual([]);
    expect(ids(pickShowcase([recipe(1, 'x', { image: '' }), recipe(2)]))).toEqual(['id2']);
    expect(ids(pickShowcase([recipe(1), recipe(2, 'x', { ingredients: [] }), recipe(3)]))).toEqual(['id1', 'id3']);
  });

  it('pinned ids win, in their order; unknown or ineligible pins are ignored', () => {
    const list = Array.from({ length: 6 }, (_, i) => recipe(i + 1));
    expect(ids(pickShowcase(list, [], 3, ['id5', 'nope', 'id2']))).toEqual(['id5', 'id2', 'id1']);
    expect(ids(pickShowcase(list, [], 3, ['id6', 'id5', 'id4', 'id3']))).toEqual(['id6', 'id5', 'id4']);
  });
});
