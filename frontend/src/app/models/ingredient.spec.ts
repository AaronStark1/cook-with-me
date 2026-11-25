import { parseAmount, parseIngredient, splitIngredient } from './ingredient';

describe('ingredient parsing', () => {
  it('splits a leading quantity and unit from the name', () => {
    expect(splitIngredient('2 tablespoons olive oil')).toEqual({ name: 'olive oil', quantity: '2 TBSP' });
    expect(splitIngredient('1 cup of flour')).toEqual({ name: 'flour', quantity: '1 CUP' });
    expect(splitIngredient('200 g spaghetti')).toEqual({ name: 'spaghetti', quantity: '200 G' });
    expect(splitIngredient('3 cloves garlic, minced')).toEqual({ name: 'garlic, minced', quantity: '3 CLOVE' });
    expect(splitIngredient('2 eggs')).toEqual({ name: 'eggs', quantity: '2' });
  });

  it('understands fractions, mixed numbers, unicode fractions and ranges', () => {
    expect(parseIngredient('1/2 teaspoon salt')).toEqual(jasmine.objectContaining({ name: 'salt', quantity: '1/2 TSP', amount: 0.5, unit: 'TSP' }));
    expect(parseIngredient('1 1/2 cups milk')).toEqual(jasmine.objectContaining({ name: 'milk', quantity: '1 1/2 CUP', amount: 1.5 }));
    expect(parseIngredient('½ cup sugar').amount).toBe(0.5);
    expect(parseIngredient('2½ cups stock').amount).toBe(2.5);
    expect(parseIngredient('1-2 tbsp honey')).toEqual(jasmine.objectContaining({ name: 'honey', quantity: '1–2 TBSP', amount: 1, amountTo: 2 }));
    expect(parseIngredient('2 to 3 cups water')).toEqual(jasmine.objectContaining({ name: 'water', amount: 2, amountTo: 3 }));
  });

  it('leaves the whole line as the name when it cannot split with confidence', () => {
    for (const line of ['Pizza dough', 'Salt and pepper to taste', 'A pinch of salt', 'Fresh basil leaves', 'Juice of 1 lemon', '7up', '2']) {
      expect(splitIngredient(line)).toEqual({ name: line, quantity: null });
    }
  });

  it('is safe with empty or missing input', () => {
    expect(parseIngredient('')).toEqual({ name: '', quantity: null, amount: null, amountTo: null, unit: null });
    expect(parseIngredient(undefined).name).toBe('');
    expect(parseIngredient('  2   cups   rice ')).toEqual(jasmine.objectContaining({ name: 'rice', quantity: '2 CUP' }));
  });

  it('parseAmount handles each numeric form and rejects the rest', () => {
    expect(parseAmount('3')).toBe(3);
    expect(parseAmount('0.25')).toBe(0.25);
    expect(parseAmount('3/4')).toBe(0.75);
    expect(parseAmount('1 3/4')).toBe(1.75);
    expect(parseAmount('¾')).toBe(0.75);
    expect(parseAmount('1/0')).toBeNull();
    expect(parseAmount('a few')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});
