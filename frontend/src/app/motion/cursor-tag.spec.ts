import { CURSOR_LERP, lerpTo } from './cursor-tag';

describe('cursor tag follow', () => {
  it('closes a fixed share of the gap each frame and converges on the pointer', () => {
    expect(lerpTo(0, 100)).toBeCloseTo(100 * CURSOR_LERP, 6);
    let x = 0;
    for (let i = 0; i < 60; i++) x = lerpTo(x, 100);
    expect(x).toBeGreaterThan(99.9);
    expect(lerpTo(40, 40)).toBe(40);
  });
});
