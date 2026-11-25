import { TestBed } from '@angular/core/testing';
import { Marquee, marqueeRate } from './marquee';

describe('marquee', () => {
  it('runs at base speed at rest, faster with the scroll, and backwards when scrolling up', () => {
    expect(marqueeRate(0)).toBe(1);
    expect(marqueeRate(0.01)).toBe(1);
    expect(marqueeRate(1)).toBeCloseTo(3.4, 6);
    expect(marqueeRate(-1)).toBeCloseTo(-3.4, 6);
    expect(marqueeRate(50)).toBe(6); // capped
    expect(marqueeRate(-50)).toBe(-6);
    expect(marqueeRate(NaN)).toBe(1);
  });

  it('under reduced motion it is the static strip: one set of words, nothing animated', () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    const fixture = TestBed.createComponent(Marquee);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.strip__group').length).toBe(1);
    expect(Array.from(el.querySelectorAll('.strip__word')).map((w) => w.textContent)).toEqual(['Discover', 'Save', 'Cook']);
    expect(el.getAnimations({ subtree: true }).length).toBe(0);
  });

  it('when moving, the duplicate track is hidden from assistive tech and the real words stay single', async () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: false, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    const fixture = TestBed.createComponent(Marquee);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const groups = (fixture.nativeElement as HTMLElement).querySelectorAll('.strip__group');
    expect(groups.length).toBe(2);
    expect(groups[0].getAttribute('aria-hidden')).toBeNull();
    expect(groups[1].getAttribute('aria-hidden')).toBe('true');
    fixture.destroy();
  });
});
