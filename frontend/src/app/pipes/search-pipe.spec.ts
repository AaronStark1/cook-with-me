import { SearchPipe } from './search-pipe';

describe('SearchPipe', () => {
  const pipe = new SearchPipe();
  const recipes = [{ name: 'Tomato Soup' }, { name: 'Chicken Curry' }, { name: 'Tomato Salad' }];

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('filters by name, ignoring case and surrounding whitespace', () => {
    expect(pipe.transform(recipes, '  TOMATO ').map((r) => r.name)).toEqual(['Tomato Soup', 'Tomato Salad']);
  });

  it('returns everything for an empty or blank key', () => {
    expect(pipe.transform(recipes, '')).toEqual(recipes);
    expect(pipe.transform(recipes, '   ')).toEqual(recipes);
  });

  it('does not throw for a null/undefined key', () => {
    expect(pipe.transform(recipes, null)).toEqual(recipes);
    expect(pipe.transform(recipes, undefined)).toEqual(recipes);
  });

  it('does not throw for recipes without a name', () => {
    const result = pipe.transform([{ name: 'Soup' }, {}, { name: null }], 'soup');
    expect(result).toEqual([{ name: 'Soup' }]);
  });

  it('returns an empty list when there are no recipes', () => {
    expect(pipe.transform(null, 'x')).toEqual([]);
    expect(pipe.transform(undefined, 'x')).toEqual([]);
  });
});
