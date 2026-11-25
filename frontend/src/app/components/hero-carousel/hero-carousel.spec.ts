import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HeroCarousel, AUTOPLAY_MS, MAX_TILT, USER_PAUSE_MS, dragSteps, tiltFor } from './hero-carousel';
import { RecipeModel } from '../../models/recipe-model';
import { appTestProviders } from '../../../testing/providers';

const recipe = (n: number): RecipeModel => ({
  _id: `id${n}`,
  name: `Recipe ${n}`,
  image: `https://example.com/${n}.jpg`,
  cuisine: 'Italian',
  mealType: ['Dinner'],
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  difficulty: 'Easy',
});
const recipes = (count: number) => Array.from({ length: count }, (_, i) => recipe(i + 1));

describe('HeroCarousel', () => {
  let fixture: ComponentFixture<HeroCarousel>;
  const el = () => fixture.nativeElement as HTMLElement;
  const cmp = () => fixture.componentInstance as any;
  const text = () => el().textContent!.replace(/\s+/g, ' ');

  const create = (list: RecipeModel[], reducedMotion = false) => {
    if (reducedMotion) {
      spyOn(window, 'matchMedia').and.returnValue({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as MediaQueryList);
    }
    fixture = TestBed.createComponent(HeroCarousel);
    fixture.componentRef.setInput('recipes', list);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HeroCarousel], providers: appTestProviders });
    sessionStorage.clear();
  });

  afterEach(() => fixture?.destroy());

  describe('with no recipes', () => {
    beforeEach(() => create([]));

    it('is a complete static hero: headline, explore link, no controls', () => {
      expect(el().querySelector('h1')!.textContent).toMatch(/good\s*food\.\s*your\s*way\./i);
      expect(el().querySelector('a[href="/all-recipes"]')).not.toBeNull();
      expect(el().querySelector('.hero__controls')).toBeNull();
      expect(el().querySelector('.hero__info')).toBeNull();
    });

    it('has no dead recipe links', () => {
      expect(el().querySelector('a[href*="/view-recipe"]')).toBeNull();
    });
  });

  describe('with one recipe', () => {
    beforeEach(() => create(recipes(1)));

    it('shows it, links to it, and offers no rotation controls', () => {
      expect(text()).toContain('Recipe 1');
      expect(el().querySelector('.hero__info a[href="/view-recipe/id1"]')).not.toBeNull();
      expect(el().querySelector('.hero__controls')).toBeNull();
    });

    it('never autoplays', fakeAsync(() => {
      tick(AUTOPLAY_MS * 3);
      expect(cmp().activeIndex()).toBe(0);
    }));
  });

  describe('with several recipes', () => {
    beforeEach(() => create(recipes(5)));

    it('shows the first recipe\'s copy, metadata and link in the info block', () => {
      const info = el().querySelector('.hero__info')!;
      expect(info.textContent).toContain('Recipe 1');
      expect(info.textContent).toContain('Italian');
      expect(info.textContent).toContain('30 min');
      expect(info.querySelector('a')!.getAttribute('href')).toBe('/view-recipe/id1');
    });

    it('only the active dish has an accessible name; the others are hidden from assistive tech', () => {
      const dishes = Array.from(el().querySelectorAll('.dish'));
      const exposed = dishes.filter((d) => d.getAttribute('aria-hidden') !== 'true');
      expect(exposed.length).toBe(1);
      expect(exposed[0].querySelector('img')!.getAttribute('alt')).toBe('Recipe 1');
      dishes.filter((d) => d !== exposed[0]).forEach((d) => expect(d.querySelector('img')!.getAttribute('alt')).toBe(''));
    });

    it('next/previous move the active recipe and keep copy, link and dots in sync', () => {
      (el().querySelector('button[aria-label="Next recipe"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().querySelector('.hero__info')!.textContent).toContain('Recipe 2');
      expect(el().querySelector('.hero__info a')!.getAttribute('href')).toBe('/view-recipe/id2');
      expect(el().querySelectorAll('.dot')[1].getAttribute('aria-current')).toBe('true');
      expect(el().querySelectorAll('.dot[aria-current="true"]').length).toBe(1);

      (el().querySelector('button[aria-label="Previous recipe"]') as HTMLButtonElement).click();
      (el().querySelector('button[aria-label="Previous recipe"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().querySelector('.hero__info')!.textContent).toContain('Recipe 5'); // wraps backwards
    });

    it('position dots have accessible names and jump the short way round', () => {
      const dots = Array.from(el().querySelectorAll<HTMLButtonElement>('.dot'));
      expect(dots.length).toBe(5);
      expect(dots[3].getAttribute('aria-label')).toBe('Show recipe 4 of 5: Recipe 4');
      dots[3].click();
      fixture.detectChanges();
      expect(cmp().activeIndex()).toBe(3);
      expect(cmp().turns()).toBe(-2); // 0 → 3 is two steps backwards, not three forwards
    });

    it('announces manual changes politely, with a live region', () => {
      (el().querySelector('button[aria-label="Next recipe"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      const live = el().querySelector('[aria-live="polite"]')!;
      expect(live.textContent).toContain('Showing recipe 2 of 5: Recipe 2');
    });

    it('arrow keys navigate', () => {
      const group = el().querySelector('[role="group"]') as HTMLElement;
      group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();
      expect(cmp().activeIndex()).toBe(1);
      group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      fixture.detectChanges();
      expect(cmp().activeIndex()).toBe(0);
    });

    it('Home and End jump to the first and last recipe', () => {
      const group = el().querySelector('[role="group"]') as HTMLElement;
      group.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      fixture.detectChanges();
      expect(cmp().activeIndex()).toBe(4);
      group.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      fixture.detectChanges();
      expect(cmp().activeIndex()).toBe(0);
    });

    it('remembers the direction of travel so the wipe can mirror it', () => {
      cmp().advance(1);
      expect(cmp().dir()).toBe(1);
      cmp().advance(-1);
      expect(cmp().dir()).toBe(-1);
      cmp().goTo(3); // 0 → 3 is the short way round: backwards
      expect(cmp().dir()).toBe(-1);
    });

    it('shows the cuisine as a decorative ghost word and decorative garnish only', () => {
      const ghost = el().querySelector('.lyr--word:not(.is-off) .ghost')!;
      expect(ghost.textContent!.trim()).toBe('ITALIAN');
      expect(ghost.closest('[aria-hidden="true"]')).not.toBeNull();
      el().querySelectorAll('app-garnish').forEach((g) => expect(g.getAttribute('aria-hidden')).toBe('true'));
    });

    it('rotates continuously: every dish moves exactly one step per turn, even across the wrap', () => {
      const thetas = () => Array.from(el().querySelectorAll<HTMLElement>('.dish')).map((d) => parseFloat(d.style.getPropertyValue('--theta')));
      for (let i = 0; i < 7; i++) {
        const before = thetas();
        cmp().advance(1);
        fixture.detectChanges();
        const after = thetas();
        after.forEach((angle, k) => expect(before[k] - angle).toBeCloseTo(72, 5)); // 360 / 5 slots, never a jump
      }
    });

    it('the platter rotates with the dishes (single source of truth)', () => {
      cmp().advance(2);
      fixture.detectChanges();
      expect(cmp().wheel()).toBe(-144);
      expect((el().querySelector('.hero') as HTMLElement).style.getPropertyValue('--wheel')).toBe('-144deg');
    });

    it('crossfades the field colour in step with the active recipe', () => {
      const on = () => Array.from(el().querySelectorAll('.hero__field-layer')).findIndex((l) => l.classList.contains('is-on'));
      expect(on()).toBe(0);
      cmp().advance(1);
      fixture.detectChanges();
      expect(on()).toBe(1);
    });
  });

  describe('autoplay', () => {
    // Updated for the motion pass: a user action now holds the rotation for 6 s (it used to re-arm at 5.2 s).
    it('advances every ~5s; any user action holds the rotation for 6s before it resumes', fakeAsync(() => {
      create(recipes(4));
      expect(cmp().activeIndex()).toBe(0);
      tick(AUTOPLAY_MS);
      fixture.detectChanges();
      expect(cmp().activeIndex()).toBe(1);

      tick(AUTOPLAY_MS - 1000);
      cmp().advance(1); // user acts: the countdown restarts, and is longer
      fixture.detectChanges();
      expect(cmp().cycleMs()).toBe(USER_PAUSE_MS);
      tick(USER_PAUSE_MS - 1);
      expect(cmp().activeIndex()).toBe(2);
      tick(1);
      expect(cmp().activeIndex()).toBe(3);

      // …and the automatic advance that follows is back on the normal cadence
      fixture.detectChanges();
      expect(cmp().cycleMs()).toBe(AUTOPLAY_MS);
      tick(AUTOPLAY_MS);
      expect(cmp().activeIndex()).toBe(0);
      fixture.destroy();
    }));

    it('a paused countdown resumes where it left off instead of starting over', fakeAsync(() => {
      create(recipes(3));
      const hero = el().querySelector('.hero')!;
      tick(AUTOPLAY_MS - 1200);
      hero.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      fixture.detectChanges();
      tick(AUTOPLAY_MS * 2);
      expect(cmp().activeIndex()).toBe(0);

      hero.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      fixture.detectChanges();
      tick(1199);
      expect(cmp().activeIndex()).toBe(0);
      tick(1);
      expect(cmp().activeIndex()).toBe(1);
      fixture.destroy();
    }));

    it('stops while less than 30% of the hero is in the viewport', fakeAsync(() => {
      create(recipes(3));
      cmp().inView.set(false);
      fixture.detectChanges();
      tick(AUTOPLAY_MS * 3);
      expect(cmp().activeIndex()).toBe(0);
      expect(el().querySelector('.hero')!.classList).toContain('is-idle'); // idle loops pause with it

      cmp().inView.set(true);
      fixture.detectChanges();
      tick(AUTOPLAY_MS);
      expect(cmp().activeIndex()).toBe(1);
      fixture.destroy();
    }));

    it('the active dot shows the countdown and freezes with it', fakeAsync(() => {
      create(recipes(3));
      const dots = () => el().querySelector('.dots') as HTMLElement;
      expect(dots().classList).toContain('is-running');
      expect(dots().style.getPropertyValue('--cycle')).toBe(`${AUTOPLAY_MS}ms`);
      cmp().toggleAutoplay();
      fixture.detectChanges();
      expect(dots().classList).not.toContain('is-running');
      fixture.destroy();
    }));

    it('pauses while the mouse hovers, and resumes when it leaves', fakeAsync(() => {
      create(recipes(3));
      const hero = el().querySelector('.hero')!;
      hero.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      fixture.detectChanges();
      tick(AUTOPLAY_MS * 3);
      expect(cmp().activeIndex()).toBe(0);

      hero.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      fixture.detectChanges();
      tick(AUTOPLAY_MS);
      expect(cmp().activeIndex()).toBe(1);
      fixture.destroy();
    }));

    it('ignores touch "hover" so a tap cannot freeze the rotation', fakeAsync(() => {
      create(recipes(3));
      el().querySelector('.hero')!.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
      fixture.detectChanges();
      tick(AUTOPLAY_MS);
      expect(cmp().activeIndex()).toBe(1);
      fixture.destroy();
    }));

    it('pauses while keyboard focus is inside, resumes when it leaves', fakeAsync(() => {
      create(recipes(3));
      const hero = el().querySelector('.hero')!;
      hero.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();
      tick(AUTOPLAY_MS * 2);
      expect(cmp().activeIndex()).toBe(0);

      hero.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
      fixture.detectChanges();
      tick(AUTOPLAY_MS);
      expect(cmp().activeIndex()).toBe(1);
      fixture.destroy();
    }));

    it('stops while the tab is hidden', fakeAsync(() => {
      create(recipes(3));
      spyOnProperty(document, 'hidden', 'get').and.returnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
      fixture.detectChanges();
      tick(AUTOPLAY_MS * 3);
      expect(cmp().activeIndex()).toBe(0);
      fixture.destroy();
    }));

    it('has a pause/play control that stops and restarts the rotation', fakeAsync(() => {
      create(recipes(3));
      const toggle = () => el().querySelector('button[aria-label$="automatic rotation"]') as HTMLButtonElement;
      expect(toggle().getAttribute('aria-label')).toBe('Pause automatic rotation');
      toggle().click();
      fixture.detectChanges();
      expect(toggle().getAttribute('aria-label')).toBe('Start automatic rotation');
      tick(AUTOPLAY_MS * 2);
      expect(cmp().activeIndex()).toBe(0);

      toggle().click();
      fixture.detectChanges();
      tick(AUTOPLAY_MS);
      expect(cmp().activeIndex()).toBe(1);
      fixture.destroy();
    }));

    it('cleans up its timer when destroyed', fakeAsync(() => {
      create(recipes(3));
      fixture.destroy();
      tick(AUTOPLAY_MS * 2); // would throw "timers still in the queue" if a timer leaked
      expect(cmp().turns()).toBe(0); // and nothing advanced after destroy
    }));
  });

  describe('drag / swipe to spin', () => {
    const W = 1000; // one position = half the hero width

    it('snaps to the nearest position', () => {
      expect(dragSteps(-520, 0, W, 0)).toBe(1);
      expect(dragSteps(-760, 0, W, 0)).toBe(2);
      expect(dragSteps(480, 10, W, 0)).toBe(-1);
      expect(dragSteps(-20, 0, W, 0)).toBe(0);
    });

    it('a short drag still counts as a swipe past 45px when it is mostly horizontal', () => {
      expect(dragSteps(-46, 5, W, 0)).toBe(1);
      expect(dragSteps(60, -20, W, 0)).toBe(-1);
      expect(dragSteps(-45, 0, W, 0)).toBe(0);
      expect(dragSteps(-60, 90, W, 0)).toBe(0); // vertical-dominant: a scroll, not a swipe
    });

    it('a fast flick carries one extra step, only in its own direction', () => {
      expect(dragSteps(-520, 0, W, -0.8)).toBe(2);
      expect(dragSteps(520, 0, W, 0.8)).toBe(-2);
      expect(dragSteps(-520, 0, W, 0.8)).toBe(1); // flicked back the other way: no bonus
      expect(dragSteps(-520, 0, W, -0.3)).toBe(1);
    });

    it('is inert without a measurable width', () => {
      expect(dragSteps(-500, 0, 0, -2)).toBe(0);
    });
  });

  describe('pointer tilt', () => {
    it('leans towards the pointer, up to ±8°, and is flat at the centre', () => {
      expect(tiltFor(0, 0, 400)).toEqual([-0, 0]);
      expect(tiltFor(400, 0, 400)).toEqual([-0, MAX_TILT]);
      expect(tiltFor(0, -400, 400)).toEqual([MAX_TILT, 0]);
      expect(tiltFor(5000, 5000, 400)).toEqual([-MAX_TILT, MAX_TILT]); // never more than the limit
      expect(tiltFor(200, 0, 400)[1]).toBe(MAX_TILT / 2);
      expect(tiltFor(10, 10, 0)).toEqual([0, 0]);
    });
  });

  describe('prefers-reduced-motion', () => {
    it('never autoplays, hides the pause control, but still allows manual navigation', fakeAsync(() => {
      create(recipes(3), true);
      tick(AUTOPLAY_MS * 3);
      expect(cmp().activeIndex()).toBe(0);
      expect(el().querySelector('button[aria-label$="automatic rotation"]')).toBeNull();
      expect(el().querySelector('.hero')!.classList).toContain('is-reduced');

      (el().querySelector('button[aria-label="Next recipe"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().querySelector('.hero__info')!.textContent).toContain('Recipe 2');
      fixture.destroy();
    }));
  });

  describe('few recipes', () => {
    it('keeps the ring full and ordered with two or three recipes', () => {
      create(recipes(3));
      expect(el().querySelectorAll('.dish').length).toBe(6); // each recipe twice, so neighbours peek in
      const names = [];
      for (let i = 0; i < 6; i++) {
        names.push(cmp().activeRecipe().name);
        cmp().advance(1);
      }
      expect(names).toEqual(['Recipe 1', 'Recipe 2', 'Recipe 3', 'Recipe 1', 'Recipe 2', 'Recipe 3']);
    });

    it('ignores records without an id or name and caps the ring at five', () => {
      create([{ name: 'No id' }, ...recipes(8), { _id: 'x' }]);
      expect(cmp().count()).toBe(5);
      expect(cmp().items().every((r: RecipeModel) => !!r._id && !!r.name)).toBeTrue();
    });
  });
});
