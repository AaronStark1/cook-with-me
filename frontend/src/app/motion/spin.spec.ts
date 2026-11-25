import { crossings, cubicBezier, landingRotation, slotAngleAfter, wheelSet } from './spin';

describe('surprise wheel', () => {
  it('always lands the chosen dish under the marker', () => {
    for (const count of [3, 5, 8]) {
      for (let winner = 0; winner < count; winner++) {
        for (const turns of [3, 4]) {
          const rotation = landingRotation(winner, count, turns);
          expect(rotation).toBeGreaterThanOrEqual(turns * 360);
          expect(rotation).toBeLessThan((turns + 1) * 360);
          const angle = slotAngleAfter(winner, count, rotation);
          expect(Math.min(angle, 360 - angle)).toBeCloseTo(0, 6);
        }
      }
    }
  });

  it('no other dish is under the marker when it stops', () => {
    const rotation = landingRotation(2, 8, 3);
    for (let slot = 0; slot < 8; slot++) {
      if (slot === 2) continue;
      const angle = slotAngleAfter(slot, 8, rotation);
      expect(Math.min(angle, 360 - angle)).toBeGreaterThan(40);
    }
  });

  it('the easing matches CSS cubic-bezier at its ends and is monotonic', () => {
    const ease = cubicBezier(0.12, 0.8, 0.2, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let last = 0;
    for (let i = 1; i <= 50; i++) {
      const value = ease(i / 50);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
    expect(ease(0.25)).toBeGreaterThan(0.7); // fast start, long settle
  });

  it('schedules a pulse each time a dish passes the marker, ending on the winner', () => {
    const total = landingRotation(3, 8, 3);
    const passes = crossings(total, 8, 2800);
    expect(passes.length).toBe(Math.floor(total / 45)); // one dish every 45°
    expect(passes[passes.length - 1].slot).toBe(3);
    expect(passes[passes.length - 1].time).toBeCloseTo(2800, 0);
    passes.forEach((p, i) => i && expect(p.time).toBeGreaterThanOrEqual(passes[i - 1].time));
  });

  it('shows at most 8 distinct recipes and always includes the winner', () => {
    const list = Array.from({ length: 20 }, (_, i) => `r${i}`);
    for (const winner of ['r0', 'r7', 'r19']) {
      const wheel = wheelSet(list, winner);
      expect(wheel.length).toBe(8);
      expect(wheel).toContain(winner);
      expect(new Set(wheel).size).toBe(8);
    }
    expect(wheelSet(['a', 'b', 'a', 'c'], 'c')).toEqual(['a', 'b', 'c']);
  });
});
