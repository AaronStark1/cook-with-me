import { ARRIVE_SPAN, ARRIVE_START, cover, wipeLinearEasing } from './tokens';

describe('motion tokens', () => {
  it('cover() reproduces the measured table', () => {
    const vectors: Array<[number, number]> = [[0.278, 0.047], [0.546, 0.246], [0.583, 0.55], [0.62, 0.825], [0.93, 0.975], [1, 1], [0, 0]];
    vectors.forEach(([t, c]) => expect(cover(t)).toBeCloseTo(c, 6));
  });

  it('cover() is clamped and monotonic', () => {
    expect(cover(-1)).toBe(0);
    expect(cover(2)).toBe(1);
    let last = 0;
    for (let i = 0; i <= 1000; i++) {
      const value = cover(i / 1000);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
  });

  it('the linear() easing agrees with cover() everywhere to within 1.5 %', () => {
    const stops = wipeLinearEasing().slice('linear('.length, -1).split(', ').map((stop, i, all) => {
      const [value, pct] = stop.split(' ');
      return { c: Number(value), t: pct ? parseFloat(pct) / 100 : i === 0 ? 0 : i === all.length - 1 ? 1 : NaN };
    });
    expect(stops.every((s) => !Number.isNaN(s.t))).toBeTrue();
    const eased = (t: number) => {
      let i = 0;
      while (stops[i + 1].t < t) i++;
      const a = stops[i];
      const b = stops[i + 1];
      return a.c + ((b.c - a.c) * (t - a.t)) / (b.t - a.t);
    };
    for (let i = 1; i < 1000; i++) expect(Math.abs(eased(i / 1000) - cover(i / 1000))).toBeLessThan(0.015);
  });

  it('the CSS --ease-wipe curve in motion.css is the same curve', () => {
    // the literal shipped in src/motion.css (38 points)
    const css = 'linear(0, 0.003 1.6%, 0.006 3.1%, 0.009 8.3%, 0.012 13.4%, 0.0175 17%, 0.023 20.6%, 0.035 24.2%, 0.047 27.8%, 0.0585 30.9%, 0.07 34%, 0.0875 37.6%, 0.105 41.2%, 0.1187 43.6%, 0.1443 46.1%, 0.158 48.5%, 0.1808 50.5%, 0.2232 52.6%, 0.246 54.6%, 0.2935 55.5%, 0.398 56.5%, 0.5025 57.4%, 0.55 58.3%, 0.593 59.2%, 0.6875 60.1%, 0.782 61.1%, 0.825 62%, 0.8444 64.3%, 0.8806 66.7%, 0.9 69%, 0.92 74%, 0.94 79%, 0.948 82%, 0.956 85%, 0.9655 89%, 0.975 93%, 0.9875 96.5%, 1)';
    const points = css.slice('linear('.length, -1).split(', ').slice(1, -1).map((stop) => stop.split(' '));
    points.forEach(([value, pct]) => expect(Math.abs(Number(value) - cover(parseFloat(pct) / 100))).toBeLessThan(0.012));
  });

  it('incoming layers land at 92 % of the run', () => {
    expect(ARRIVE_START + ARRIVE_SPAN).toBeCloseTo(0.92, 6);
  });
});
