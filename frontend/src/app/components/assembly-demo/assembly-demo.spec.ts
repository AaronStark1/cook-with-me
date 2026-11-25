import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssemblyDemo } from './assembly-demo';
import { RecipeModel } from '../../models/recipe-model';
import { appTestProviders } from '../../../testing/providers';

const recipe = (n: number, ingredients: string[]): RecipeModel => ({
  _id: `id${n}`, name: `Recipe ${n}`, image: `https://example.com/${n}.jpg`, cuisine: 'Italian', mealType: ['Dinner'],
  prepTimeMinutes: 10, cookTimeMinutes: 20, difficulty: 'Easy', ingredients, instructions: ['a', 'b', 'c'],
});
const LONG = ['2 tablespoons olive oil', 'Fresh basil leaves', '3 cloves garlic', 'Tomato sauce', 'Salt', 'Flour', 'Butter', 'Milk', 'Eggs', 'Sugar', 'Yeast'];

describe('AssemblyDemo', () => {
  let fixture: ComponentFixture<AssemblyDemo>;
  const el = () => fixture.nativeElement as HTMLElement;
  const scene = (i: number) => el().querySelector(`[data-scene="${i}"]`) as HTMLElement;

  // Reduced motion gives the static driver: the natural layout, with nothing animated.
  const create = (list: RecipeModel[], reduced = true) => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: reduced, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    TestBed.configureTestingModule({ imports: [AssemblyDemo], providers: appTestProviders });
    fixture = TestBed.createComponent(AssemblyDemo);
    fixture.componentRef.setInput('recipes', list);
    fixture.detectChanges();
  };

  afterEach(() => fixture?.destroy());

  it('says only what is true: one heading, one photo per recipe, no claim of other angles', () => {
    create([recipe(1, LONG), recipe(2, ['a', 'b', 'c'])]);
    expect(el().querySelector('h2')!.textContent).toContain('Watch it come together.');
    expect(scene(0).querySelectorAll('img').length).toBe(1);
    expect(el().textContent).not.toMatch(/photos|every angle|all sides|360/i);
  });

  it('the tickets are the real ingredient list: at most 8, then "+N more"', () => {
    create([recipe(1, LONG)]);
    const list = scene(0).querySelector('ul[aria-label="Ingredients"]')!;
    const names = Array.from(list.querySelectorAll('.ticket__name')).map((n) => n.textContent!.trim());
    expect(names).toEqual(['olive oil', 'Fresh basil leaves', 'garlic', 'Tomato sauce', 'Salt', 'Flour', 'Butter', 'Milk', '+3 more']);
    expect(list.querySelector('.ticket__qty')!.textContent!.trim()).toBe('2 TBSP'); // only where the text gives one
    expect(list.querySelectorAll('.ticket__qty').length).toBe(2);
  });

  it('under reduced motion it is a static, fully assembled dish with instant angle buttons', () => {
    create([recipe(1, LONG), recipe(2, ['a', 'b', 'c'])]);
    expect(el().querySelector('.asm')!.classList).toContain('asm--static');
    expect(el().querySelector('.asm__player')).toBeNull(); // no autoplay, no scrubber
    expect(el().querySelectorAll('.asm')[0].getAnimations({ subtree: true }).length).toBe(0);

    const buttons = Array.from(el().querySelectorAll<HTMLButtonElement>('.asm__angles button'));
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['Top-down', 'Three-quarter', 'Low']);
    buttons[2].click();
    fixture.detectChanges();
    const stage = el().querySelector('.asm__stage') as HTMLElement;
    expect(stage.style.getPropertyValue('--ex')).toBe('62.00deg'); // clamped to the 62° tilt limit
    expect(stage.style.getPropertyValue('--ez')).toBe('-62.00deg');
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
  });

  it('links to the recipe and to Cook Mode (?cook=1)', () => {
    create([recipe(1, LONG)]);
    const links = Array.from(scene(0).querySelectorAll('.asm__links a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/view-recipe/id1?cook=1', '/view-recipe/id1']);
  });

  it('the stepper jumps between recipes and announces only that user action', () => {
    create([recipe(1, LONG), recipe(2, ['a', 'b', 'c']), recipe(3, ['a', 'b', 'c'])]);
    const live = el().querySelector('.asm [aria-live="polite"]')!;
    expect(live.textContent!.trim()).toBe('');
    const steps = Array.from(el().querySelectorAll<HTMLButtonElement>('.asm__btn--step'));
    expect(steps.length).toBe(3);
    steps[1].click();
    fixture.detectChanges();
    expect(steps[1].getAttribute('aria-current')).toBe('true');
    expect(live.textContent).toContain('Showing Recipe 2, 2 of 3');
    expect(scene(1).getAttribute('aria-hidden')).toBeNull();
    expect(scene(0).getAttribute('aria-hidden')).toBe('true');
    expect(scene(0).hasAttribute('inert')).toBeTrue();
  });

  it('a single recipe needs no stepper; the plate is a keyboard control', () => {
    create([recipe(1, LONG)]);
    expect(el().querySelector('.asm__steps')).toBeNull();
    const turn = scene(0).querySelector('.asm__turn') as HTMLButtonElement;
    expect(turn.disabled).toBeFalse();
    turn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    turn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    const stage = el().querySelector('.asm__stage') as HTMLElement;
    expect(stage.style.getPropertyValue('--ez')).toBe('15.00deg');
    expect(stage.style.getPropertyValue('--ex')).toBe('15.00deg');
    turn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(stage.style.getPropertyValue('--ex')).toBe('0.00deg');
    expect(stage.style.getPropertyValue('--ez')).toBe('0.00deg');
  });

  it('has a "Skip demo" link as its first focusable element', () => {
    create([recipe(1, LONG)]);
    const first = el().querySelector('a, button, [tabindex]') as HTMLElement;
    expect(first.textContent!.trim()).toBe('Skip demo');
  });
});
