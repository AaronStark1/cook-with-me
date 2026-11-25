import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FLIP_CAP, FLIP_STAGGER_MS, Flip, flipEntering, flipMoves } from './flip';

describe('FLIP maths', () => {
  const at = (left: number, top: number) => ({ left, top });

  it('survivors travel from where they were to where they are', () => {
    const before = new Map([['a', at(0, 0)], ['b', at(100, 0)], ['c', at(200, 0)]]);
    const after = new Map([['a', at(0, 0)], ['c', at(100, 0)]]); // b left, c closed the gap
    expect(flipMoves(before, after)).toEqual([{ key: 'c', dx: 100, dy: 0, delay: 0 }]);
  });

  it('staggers by 18ms and animates at most 12 items', () => {
    const before = new Map<number, { left: number; top: number }>();
    const after = new Map<number, { left: number; top: number }>();
    for (let i = 0; i < 20; i++) {
      before.set(i, at(i * 10, 0));
      after.set(i, at(i * 10, 50));
    }
    const moves = flipMoves(before, after);
    expect(moves.length).toBe(FLIP_CAP);
    expect(moves[3]).toEqual({ key: 3, dx: 0, dy: -50, delay: 3 * FLIP_STAGGER_MS });
  });

  it('ignores items that did not move and reports new ones separately', () => {
    const before = new Map([['a', at(0, 0)]]);
    const after = new Map([['a', at(0, 0.2)], ['n', at(100, 0)]]);
    expect(flipMoves(before, after)).toEqual([]);
    expect(flipEntering(before, after)).toEqual(['n']);
  });
});

@Component({
  standalone: true,
  imports: [Flip],
  template: `<ul appFlip style="position:relative;display:grid;grid-template-columns:repeat(3,50px)">
    @for (i of items; track i) { <li style="height:20px">{{ i }}</li> }
  </ul>`,
})
class Host {
  items = [1, 2, 3, 4, 5];
}

describe('appFlip', () => {
  const setup = (reduced: boolean) => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: reduced, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const list = fixture.nativeElement.querySelector('ul') as HTMLElement;
    return { fixture, list, animate: spyOn(Element.prototype, 'animate').and.callThrough() };
  };
  const mutationsDelivered = () => new Promise((resolve) => setTimeout(resolve));
  const real = (list: HTMLElement) => Array.from(list.querySelectorAll('li:not([data-flip-leaving])')).map((c) => c.textContent!.trim());

  it('under reduced motion nothing animates and no ghost is left behind', async () => {
    const { fixture, list, animate } = setup(true);
    fixture.componentInstance.items = [1, 3, 5];
    fixture.detectChanges();
    await mutationsDelivered();

    expect(Array.from(list.children).map((c) => c.textContent!.trim())).toEqual(['1', '3', '5']);
    expect(animate).not.toHaveBeenCalled();
  });

  it('the rendered list is the data at once; the removed item only lingers as an inert, hidden ghost', async () => {
    const { fixture, list, animate } = setup(false);
    fixture.componentInstance.items = [1, 3, 4, 5];
    fixture.detectChanges();
    expect(Array.from(list.children).map((c) => c.textContent!.trim())).toEqual(['1', '3', '4', '5']); // synchronously true

    await mutationsDelivered();
    const ghost = list.querySelector('[data-flip-leaving]') as HTMLElement;
    expect(ghost.textContent!.trim()).toBe('2');
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(ghost.hasAttribute('inert')).toBeTrue();
    expect(ghost.style.position).toBe('absolute');
    expect(real(list)).toEqual(['1', '3', '4', '5']);
    expect(animate.calls.count()).toBeGreaterThan(1); // the wipe + at least one glide

    list.getAnimations({ subtree: true }).forEach((a) => a.finish());
    await mutationsDelivered();
    expect(list.querySelector('[data-flip-leaving]')).toBeNull(); // gone once its wipe has finished
  });

  it('does not animate the first render', async () => {
    const { animate } = setup(false);
    await mutationsDelivered();
    expect(animate).not.toHaveBeenCalled();
  });
});
