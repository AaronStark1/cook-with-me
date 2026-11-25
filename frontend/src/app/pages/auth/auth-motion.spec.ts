import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PLATTER_DRIFT_PX, PlatterDrift, platterDrift } from './auth-motion';

@Component({
  standalone: true,
  imports: [PlatterDrift],
  template: `<div class="platter" appPlatterDrift></div>`,
})
class Host {}

const media = (matches: boolean) =>
  ({ matches, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const move = (clientX: number, clientY: number) =>
  window.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY }));

describe('platterDrift', () => {
  it('rests in the middle of the viewport', () => {
    expect(platterDrift(0.5, 0.5)).toEqual({ x: 0, y: 0 });
  });

  it('never drifts further than 8 px from rest, even from a corner or beyond the viewport', () => {
    for (const [x, y] of [[0, 0], [1, 1], [1, 0], [-3, 9], [NaN, 1]]) {
      const drift = platterDrift(x, y);
      expect(Math.hypot(drift.x, drift.y)).toBeLessThanOrEqual(PLATTER_DRIFT_PX);
    }
    expect(Math.hypot(platterDrift(1, 1).x, platterDrift(1, 1).y)).toBeGreaterThan(7.9);
  });
});

describe('PlatterDrift', () => {
  const create = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return { fixture, platter: fixture.nativeElement.querySelector('.platter') as HTMLElement };
  };

  it('writes the offset as custom properties, once per frame, on fine pointers', async () => {
    spyOn(window, 'matchMedia').and.callFake((query: string) => media(query.includes('pointer: fine')));
    const { fixture, platter } = create();
    const write = spyOn(platter.style, 'setProperty').and.callThrough();

    move(0, 0);
    move(window.innerWidth, window.innerHeight);
    await nextFrame();

    expect(write.calls.count()).toBe(2); // --px and --py, for the last position only
    expect(parseFloat(platter.style.getPropertyValue('--px'))).toBeCloseTo(PLATTER_DRIFT_PX / Math.SQRT2, 1);
    expect(parseFloat(platter.style.getPropertyValue('--py'))).toBeCloseTo(PLATTER_DRIFT_PX / Math.SQRT2, 1);

    // gone with the page: no listener is left behind
    fixture.destroy();
    write.calls.reset();
    move(0, 0);
    await nextFrame();
    expect(write).not.toHaveBeenCalled();
  });

  it('stays still on touch / coarse pointers', async () => {
    spyOn(window, 'matchMedia').and.returnValue(media(false));
    const { platter } = create();

    move(0, 0);
    await nextFrame();

    expect(platter.style.getPropertyValue('--px')).toBe('');
  });

  it('stays still under reduced motion', async () => {
    spyOn(window, 'matchMedia').and.returnValue(media(true));
    const { platter } = create();

    move(0, 0);
    await nextFrame();

    expect(platter.style.getPropertyValue('--px')).toBe('');
  });
});
