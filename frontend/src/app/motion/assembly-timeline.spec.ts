import {
  AssemblyTimeline, HANDOFF_MS, HOLD_MS, ITEM_MS, PHASES, angleLabelAt, arcMid, driverFor, itemStart, locate, onCircle, phaseAt,
  ticketEntry, ticketList, ticketTier, totalMs,
} from './assembly-timeline';

describe('assembly timeline maths', () => {
  it('phases tile the 8s timeline with no gaps', () => {
    expect(PHASES[0].from).toBe(0);
    expect(PHASES[PHASES.length - 1].to).toBe(ITEM_MS);
    PHASES.forEach((p, i) => i && expect(p.from).toBe(PHASES[i - 1].to));
  });

  it('maps progress to a phase at every boundary', () => {
    expect(phaseAt(-5)).toBe('set');
    expect(phaseAt(0)).toBe('set');
    expect(phaseAt(599)).toBe('set');
    expect(phaseAt(600)).toBe('gather');
    expect(phaseAt(2600)).toBe('converge');
    expect(phaseAt(4000)).toBe('build');
    expect(phaseAt(5200)).toBe('orbit');
    expect(phaseAt(7000)).toBe('present');
    expect(phaseAt(8000)).toBe('present');
    expect(phaseAt(99999)).toBe('present');
  });

  it('names the camera angle through the orbit, and top-down outside it', () => {
    expect(angleLabelAt(1000)).toBe('Top-down');
    expect(angleLabelAt(5210)).toBe('Top-down');
    expect(angleLabelAt(5200 + 1800 * 0.33)).toBe('Three-quarter');
    expect(angleLabelAt(5200 + 1800 * 0.66)).toBe('Low');
    expect(angleLabelAt(6990)).toBe('Top-down');
    expect(angleLabelAt(7500)).toBe('Top-down');
  });

  it('scroll time locates the item, its local time, the hold and the hand-off', () => {
    const segment = ITEM_MS + HOLD_MS + HANDOFF_MS;
    expect(totalMs(3)).toBe(3 * (ITEM_MS + HOLD_MS) + 2 * HANDOFF_MS);
    expect(totalMs(0)).toBe(0);
    expect(itemStart(2)).toBe(2 * segment);

    expect(locate(0, 3)).toEqual({ item: 0, local: 0, hold: false, handoff: null });
    expect(locate(4500, 3)).toEqual({ item: 0, local: 4500, hold: false, handoff: null });
    expect(locate(ITEM_MS + 100, 3)).toEqual({ item: 0, local: ITEM_MS, hold: true, handoff: null });
    expect(locate(ITEM_MS + HOLD_MS + 400, 3)).toEqual({ item: 0, local: ITEM_MS, hold: false, handoff: 400 });
    expect(locate(segment + 700, 3)).toEqual({ item: 1, local: 700, hold: false, handoff: null });
    // the last item never hands off: it holds to the end
    expect(locate(totalMs(3), 3)).toEqual({ item: 2, local: ITEM_MS, hold: true, handoff: null });
    expect(locate(totalMs(3) + 5000, 3).item).toBe(2);
    expect(locate(-50, 3).local).toBe(0);
    expect(locate(100, 0)).toEqual({ item: 0, local: 0, hold: false, handoff: null });
  });

  it('scrubbing backwards is the same mapping in reverse', () => {
    const forward = [0, 1000, 5000, 9000, 9800, 12000, 20000].map((t) => locate(t, 2));
    const backward = [20000, 12000, 9800, 9000, 5000, 1000, 0].map((t) => locate(t, 2)).reverse();
    expect(backward).toEqual(forward);
  });

  it('picks the scroll driver only on wide, fine-pointer, motion-friendly screens', () => {
    const env = { width: 1440, finePointer: true, reduced: false, canObserve: true };
    expect(driverFor(env)).toBe('scroll');
    expect(driverFor({ ...env, width: 1023 })).toBe('player');
    expect(driverFor({ ...env, finePointer: false })).toBe('player');
    expect(driverFor({ ...env, reduced: true })).toBe('static');
    expect(driverFor({ ...env, width: 390, reduced: true })).toBe('static');
    expect(driverFor({ ...env, canObserve: false })).toBe('static'); // nothing may stay hidden if we cannot observe
  });

  it('assigns depth tiers deterministically, with at most three near tickets out of eight', () => {
    const tiers = Array.from({ length: 8 }, (_, i) => ticketTier(i));
    expect(tiers.map((t) => t.name)).toEqual(['near', 'mid', 'far', 'near', 'mid', 'far', 'near', 'mid']);
    expect(tiers.filter((t) => t.blur).length).toBe(3);
    expect(ticketTier(0)).toEqual({ name: 'near', scale: 1.15, parallax: 0.75, blur: true });
    expect(ticketTier(2)).toEqual({ name: 'far', scale: 0.85, parallax: 0.4, blur: false });
  });

  it('entry points use all four edges, sit off-stage, and are identical on every call', () => {
    const entries = Array.from({ length: 8 }, (_, i) => ticketEntry(i));
    expect(entries).toEqual(Array.from({ length: 8 }, (_, i) => ticketEntry(i)));
    expect(entries[0].x).toBeLessThan(0);
    expect(entries[1].y).toBeLessThan(0);
    expect(entries[2].x).toBeGreaterThan(1);
    expect(entries[3].y).toBeGreaterThan(1);
    entries.forEach((e) => expect(e.x < 0 || e.x > 1 || e.y < 0 || e.y > 1).toBeTrue());
    expect(new Set(entries.map((e) => `${e.x.toFixed(3)},${e.y.toFixed(3)}`)).size).toBe(8);
  });

  it('paths are arcs: the mid-point is bowed off the straight line', () => {
    expect(arcMid({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.2)).toEqual({ x: 50, y: 20 });
    expect(arcMid({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)).toEqual({ x: 50, y: 0 });
    const top = onCircle({ x: 10, y: 10 }, 5, 0);
    expect(top.x).toBeCloseTo(10, 6);
    expect(top.y).toBeCloseTo(5, 6);
    expect(onCircle({ x: 0, y: 0 }, 10, 90).x).toBeCloseTo(10, 6);
  });

  it('shows at most eight tickets and counts the rest', () => {
    const many = Array.from({ length: 11 }, (_, i) => `i${i}`);
    expect(ticketList(many)).toEqual({ shown: many.slice(0, 8), more: 3 });
    expect(ticketList(['a', 'b', 'c'])).toEqual({ shown: ['a', 'b', 'c'], more: 0 });
    expect(ticketList(many, 5).more).toBe(6);
    expect(ticketList(undefined)).toEqual({ shown: [], more: 0 });
  });
});

describe('AssemblyTimeline engine', () => {
  it('scrubs every track from one clock, forwards and backwards, and cleans up', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    const timeline = new AssemblyTimeline([
      { el: a, keyframes: [{ opacity: 0 }, { opacity: 1 }], from: 0, duration: 1000 },
      { el: b, keyframes: [{ opacity: 0 }, { opacity: 1 }], from: 4000, duration: 1000 },
      { el: null, keyframes: [], from: 0, duration: 1 }, // missing elements are skipped
    ]);
    expect(timeline.size).toBe(2);

    timeline.seek(500);
    expect(+getComputedStyle(a).opacity).toBeCloseTo(0.5, 2);
    expect(+getComputedStyle(b).opacity).toBe(0); // held on its first frame until it starts

    timeline.seek(4500);
    expect(+getComputedStyle(a).opacity).toBe(1);
    expect(+getComputedStyle(b).opacity).toBeCloseTo(0.5, 2);

    timeline.seek(250); // backwards
    expect(+getComputedStyle(a).opacity).toBeCloseTo(0.25, 2);
    expect(+getComputedStyle(b).opacity).toBe(0);
    expect(timeline.time).toBe(250);

    timeline.destroy();
    expect(+getComputedStyle(a).opacity).toBe(1); // back to the natural, assembled state
    a.remove();
    b.remove();
  });

  it('keeps time on its own clock, so a short first track cannot stall it', () => {
    const a = document.createElement('div');
    document.body.append(a);
    const timeline = new AssemblyTimeline([{ el: a, keyframes: [{ opacity: 0 }, { opacity: 1 }], from: 0, duration: 600 }]);
    timeline.seek(5000); // long after the only track has ended
    expect(timeline.time).toBe(5000);
    expect(timeline.size).toBe(1);

    // resuming must not rewind the finished track and play it again
    timeline.play();
    expect(timeline.isPlaying).toBeTrue();
    expect(+getComputedStyle(a).opacity).toBe(1);
    timeline.pause();
    expect(timeline.time).toBeGreaterThanOrEqual(5000);

    timeline.seek(8000);
    timeline.play(); // already at the end: nothing to run
    expect(timeline.isPlaying).toBeFalse();
    timeline.destroy();
    a.remove();
  });
});
