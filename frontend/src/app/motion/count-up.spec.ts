import { countFrame } from './count-up';

describe('count-up', () => {
  it('starts at zero, ends exactly on the target, and never overshoots', () => {
    expect(countFrame(480, 0)).toBe(0);
    expect(countFrame(480, 1)).toBe(480);
    expect(countFrame(480, 5)).toBe(480);
    expect(countFrame(480, -1)).toBe(0);
    let last = 0;
    for (let i = 0; i <= 100; i++) {
      const value = countFrame(480, i / 100);
      expect(value).toBeGreaterThanOrEqual(last);
      expect(value).toBeLessThanOrEqual(480);
      last = value;
    }
  });

  it('eases out: most of the distance is covered early', () => {
    expect(countFrame(100, 0.5)).toBeGreaterThan(80);
  });

  it('is safe with junk', () => {
    expect(countFrame(NaN, 0.5)).toBe(0);
  });
});
