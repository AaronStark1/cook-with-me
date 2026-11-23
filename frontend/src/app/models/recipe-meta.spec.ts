import { recipeMeta, totalMinutes } from './recipe-meta';

describe('recipe metadata helpers', () => {
  it('adds prep and cook time', () => {
    expect(totalMinutes({ prepTimeMinutes: 10, cookTimeMinutes: 25 })).toBe(35);
  });

  it('uses whichever time exists, and null when there is none (or it is zero)', () => {
    expect(totalMinutes({ cookTimeMinutes: 20 })).toBe(20);
    expect(totalMinutes({})).toBeNull();
    expect(totalMinutes({ prepTimeMinutes: 0, cookTimeMinutes: 0 })).toBeNull();
  });

  it('lists cuisine, first meal type, time and difficulty — only those present', () => {
    expect(recipeMeta({ cuisine: 'Thai', mealType: ['Dinner', 'Lunch'], prepTimeMinutes: 5, cookTimeMinutes: 10, difficulty: 'Easy' }))
      .toEqual(['Thai', 'Dinner', '15 min', 'Easy']);
    expect(recipeMeta({ cuisine: 'Thai' })).toEqual(['Thai']);
    expect(recipeMeta({})).toEqual([]);
  });
});
