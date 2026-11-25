import { fitGhostWord, ghostWord } from './ghost-fit';

describe('ghost word', () => {
  const metrics = (length: number) => ({ width: length * 0.9, cap: 0.7, ascent: 0.9, descent: 0.3, length });

  it('uses the target cap height when the word fits', () => {
    const fit = fitGhostWord(metrics(4), { width: 63, capTarget: 7 });
    expect(fit.size).toBeCloseTo(10, 6);
    expect(fit.spacing).toBe(0);
    expect(fit.width).toBeCloseTo(36, 6);
  });

  it('tightens the letter-spacing before it shrinks the type', () => {
    // 5 letters: 4.5em × 14.5 = 65.25 > 63 → needs −0.0388em per gap, within the −0.06 limit
    const fit = fitGhostWord(metrics(5), { width: 63, capTarget: 10.15 });
    expect(fit.size).toBeCloseTo(14.5, 6);
    expect(fit.spacing).toBeLessThan(0);
    expect(fit.spacing).toBeGreaterThanOrEqual(-0.06);
    expect(fit.width).toBeCloseTo(63, 6);
  });

  it('long words shrink to fit and never overflow the box', () => {
    for (const length of [7, 9, 13, 20]) {
      const fit = fitGhostWord(metrics(length), { width: 63, capTarget: 14 });
      expect(fit.width).toBeLessThanOrEqual(63 + 1e-9);
      expect(fit.spacing).toBeCloseTo(-0.06, 6);
      expect(fit.size).toBeLessThan(20);
    }
  });

  it('reports where the caps sit in a line-height:1 box', () => {
    // content area 1.2em centred in 1em → starts at −0.1em; caps span 0.1em…0.8em → centre 0.45em
    expect(fitGhostWord(metrics(4), { width: 100, capTarget: 10 }).capCentre).toBeCloseTo(0.45, 6);
  });

  it('comes from the cuisine, then the first meal type, then the first word of the name', () => {
    expect(ghostWord({ cuisine: 'Italian', mealType: ['Dinner'], name: 'Pizza' })).toBe('ITALIAN');
    expect(ghostWord({ mealType: ['Dinner'], name: 'Pizza' })).toBe('DINNER');
    expect(ghostWord({ name: 'Classic Margherita Pizza' })).toBe('CLASSIC');
    expect(ghostWord({})).toBe('');
    expect(ghostWord(null)).toBe('');
  });
});
