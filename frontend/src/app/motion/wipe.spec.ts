import { arrive, arriveKeyframes, arriveTiming, driftKeyframes, group, revealKeyframes, sweepKeyframes, wipe, wipeKeyframes } from './wipe';

describe('wipe maths', () => {
  it('forward covers the leaving layer from the right, back from the left', () => {
    expect(wipeKeyframes(1)).toEqual([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 100% 0 0)' }]);
    expect(wipeKeyframes(-1)).toEqual([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }]);
  });

  it('incoming layers are uncovered by exactly what the wipe has covered', () => {
    expect(revealKeyframes(1)).toEqual([{ clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0)' }]);
    expect(revealKeyframes(-1)).toEqual([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }]);
  });

  it('the leaving content drifts 14 % of the width, mirrored by direction', () => {
    expect(driftKeyframes(1, 1000)[1]).toEqual({ translate: '-140px 0px' });
    expect(driftKeyframes(-1, 1000)[1]).toEqual({ translate: '140px 0px' });
  });

  it('a flat colour panel leaves whole, taking its 6px edge with it, mirrored by direction', () => {
    expect(sweepKeyframes(1)[1]).toEqual({ translate: 'calc(-100% - 6px) 0px' });
    expect(sweepKeyframes(-1)[1]).toEqual({ translate: 'calc(100% + 6px) 0px' });
  });

  it('incoming layers start at dir × factor × width and settle at rest', () => {
    expect(arriveKeyframes(1, 0.4, 1440)).toEqual([{ translate: '576px 0px' }, { translate: '0px 0px' }]);
    expect(arriveKeyframes(-1, 0.75, 1000)[0]).toEqual({ translate: '-750px 0px' });
  });

  it('arrival starts at half the run, lasts 42 % and holds its start pose until then', () => {
    expect(arriveTiming(970)).toEqual(jasmine.objectContaining({ delay: 485, duration: 407.4, fill: 'backwards' }));
    expect(arriveTiming(640)).toEqual(jasmine.objectContaining({ delay: 320, duration: 268.8 }));
  });

  it('runners are safe without an element and resolve when finished early (latest wins)', async () => {
    await wipe(null, { dir: 1 }).finished;
    const el = document.createElement('div');
    document.body.appendChild(el);
    const handle = group([wipe(el, { dir: 1, duration: 5000 }), arrive(el, { dir: 1, factor: 0.4, width: 100, duration: 5000 })]);
    handle.finish();
    await handle.finished;
    expect(getComputedStyle(el).clipPath).toBe('inset(0px 100% 0px 0px)');
    handle.cancel();
    expect(getComputedStyle(el).clipPath).toBe('none');
    el.remove();
  });
});
