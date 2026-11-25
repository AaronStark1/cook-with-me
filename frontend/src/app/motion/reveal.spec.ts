import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Reveal, RevealObserver, STAGGER_CAP } from './reveal';

@Component({
  standalone: true,
  imports: [Reveal],
  template: `
    <h2 appReveal="mask" id="a">Title</h2>
    <ul appReveal="rise stagger" id="b">@for (i of items; track i) { <li>{{ i }}</li> }</ul>
  `,
})
class Host {
  items = Array.from({ length: 12 }, (_, i) => i);
}

const reduce = (matches: boolean) =>
  spyOn(window, 'matchMedia').and.returnValue({ matches, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);

describe('appReveal', () => {
  const render = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('adds nothing under reduced motion — content is simply visible', () => {
    reduce(true);
    const el = render();
    expect(el.querySelector('#a')!.classList.contains('rv')).toBeFalse();
    expect(el.querySelector('#b')!.classList.contains('rv')).toBeFalse();
  });

  it('leaves content visible when the platform cannot observe', () => {
    reduce(false);
    TestBed.overrideProvider(RevealObserver, { useValue: { supported: false, observe() {}, unobserve() {} } });
    expect(render().querySelector('#a')!.classList.contains('rv')).toBeFalse();
  });

  it('hides, then reveals on entering view; stagger indexes children with a cap', () => {
    reduce(false);
    let enter: Array<() => void> = [];
    TestBed.overrideProvider(RevealObserver, {
      useValue: { supported: true, observe: (_: Element, cb: () => void) => enter.push(cb), unobserve() {} },
    });
    const el = render();
    const title = el.querySelector('#a')!;
    const list = el.querySelector('#b')!;
    expect(title.classList).toContain('rv');
    expect(title.classList).toContain('rv--mask');
    expect(title.classList).not.toContain('is-in');
    expect(list.classList).toContain('rv--stagger');

    enter.forEach((cb) => cb());
    expect(title.classList).toContain('is-in');
    const indexes = Array.from(list.children).map((c) => (c as HTMLElement).style.getPropertyValue('--i'));
    expect(indexes.slice(0, 3)).toEqual(['0', '1', '2']);
    expect(indexes[11]).toBe(String(STAGGER_CAP));
  });
});
