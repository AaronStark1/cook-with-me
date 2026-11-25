import { scrollFrame } from './scroll-state';

describe('scrollFrame', () => {
  it('reports progress, direction and velocity', () => {
    expect(scrollFrame(500, 400, 20, 1000)).toEqual({ y: 500, progress: 0.5, direction: 1, velocity: 5 });
    expect(scrollFrame(300, 400, 50, 1000)).toEqual({ y: 300, progress: 0.3, direction: -1, velocity: -2 });
  });

  it('is safe on pages that do not scroll and on a zero time step', () => {
    expect(scrollFrame(0, 0, 0, 0)).toEqual({ y: 0, progress: 0, direction: 0, velocity: 0 });
    expect(scrollFrame(1200, 0, 16, 1000).progress).toBe(1);
  });
});
