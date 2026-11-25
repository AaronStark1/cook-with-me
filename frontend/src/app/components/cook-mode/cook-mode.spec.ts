import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { CookMode, resumeStep, swipeStep } from './cook-mode';
import { appTestProviders } from '../../../testing/providers';
import { fakeJwt } from '../../../testing/jwt';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

const RECIPE = {
  _id: 'abc', name: 'Pad Thai', ingredients: ['Noodles', 'Peanuts', 'Lime'],
  instructions: ['Soak the noodles.', 'Fry the garlic.', 'Toss everything together.'],
};

describe('Cook Mode helpers', () => {
  it('resumes only when the saved step still fits the recipe', () => {
    expect(resumeStep({ step: 2, total: 5 }, 5)).toBe(2);
    expect(resumeStep({ step: 5, total: 5 }, 5)).toBe(0); // was on the finish screen: start again
    expect(resumeStep({ step: 2, total: 4 }, 5)).toBe(0); // the recipe changed
    expect(resumeStep({ step: -1, total: 5 }, 5)).toBe(0);
    expect(resumeStep(null, 5)).toBe(0);
  });

  it('a swipe needs more than 45px and must be mostly horizontal', () => {
    expect(swipeStep(-46, 10)).toBe(1); // swipe left → next
    expect(swipeStep(80, -20)).toBe(-1); // swipe right → previous
    expect(swipeStep(-45, 0)).toBe(0);
    expect(swipeStep(-60, 90)).toBe(0); // a vertical scroll
  });
});

describe('CookMode', () => {
  let fixture: ComponentFixture<CookMode>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const dialog = () => el().querySelector('dialog') as HTMLDialogElement;
  const cmp = () => fixture.componentInstance as any;
  const text = () => el().querySelector('.cook__panel:not([aria-hidden]) .cook__drift')!.textContent!.replace(/\s+/g, ' ').trim();
  const key = (k: string, target: Element = dialog()) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };
  const clear = () => Object.keys(localStorage).filter((k) => k.startsWith('cwm.')).forEach((k) => localStorage.removeItem(k));

  const open = async (reduced = true, spy = true) => {
    if (spy) spyOn(window, 'matchMedia').and.returnValue({ matches: reduced, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    await TestBed.configureTestingModule({ imports: [CookMode], providers: appTestProviders }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CookMode);
    fixture.componentRef.setInput('recipe', RECIPE);
    document.body.appendChild(el());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => { clear(); sessionStorage.clear(); });
  afterEach(() => {
    if (dialog()?.open) dialog().close();
    fixture?.destroy();
    el()?.remove();
    document.documentElement.style.overflow = '';
    clear();
    sessionStorage.clear();
  });

  it('opens as a modal dialog named after the recipe, locks page scroll and traps focus inside', async () => {
    await open();
    expect(dialog().open).toBeTrue();
    expect(dialog().matches(':modal')).toBeTrue();
    expect(document.getElementById(dialog().getAttribute('aria-labelledby')!)!.textContent).toContain('Pad Thai');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(dialog().contains(document.activeElement)).toBeTrue();
    expect(text()).toContain('01');
    expect(text()).toContain('Soak the noodles.');
  });

  it('arrow keys, Space and Enter move through the steps; every change is announced', async () => {
    await open();
    const live = () => el().querySelector('[aria-live="polite"]')!.textContent!.trim();
    expect(live()).toBe('Step 1 of 3: Soak the noodles.');
    key('ArrowRight');
    expect(text()).toContain('Fry the garlic.');
    expect(live()).toBe('Step 2 of 3: Fry the garlic.');
    key(' ');
    expect(text()).toContain('Toss everything together.');
    key('ArrowLeft');
    expect(text()).toContain('Fry the garlic.');
    key('Enter');
    expect(cmp().index()).toBe(2);
    key('ArrowLeft');
    key('ArrowLeft');
    key('ArrowLeft'); // cannot go before the first step
    expect(cmp().index()).toBe(0);
  });

  it('Space / Enter on a focused control press that control instead of skipping a step', async () => {
    await open();
    const ingredients = el().querySelector('.cook__btn--mid') as HTMLButtonElement;
    key(' ', ingredients);
    key('Enter', ingredients);
    expect(cmp().index()).toBe(0);
  });

  it('on-screen buttons work, Previous is disabled on the first step, and the last Next says "Finish"', async () => {
    await open();
    const [previous, next] = [el().querySelector('.cook__btn--nav') as HTMLButtonElement, el().querySelector('.cook__btn--next') as HTMLButtonElement];
    expect(previous.disabled).toBeTrue();
    next.click();
    fixture.detectChanges();
    expect(previous.disabled).toBeFalse();
    next.click();
    fixture.detectChanges();
    expect(next.textContent).toContain('Finish');
    next.click();
    fixture.detectChanges();
    expect(text()).toContain('Nice one.');
    expect(next.disabled).toBeTrue();
  });

  it('a swipe left goes forward and a swipe right goes back', async () => {
    await open();
    const stage = el().querySelector('.cook__stage')!;
    const swipe = (from: number, to: number) => {
      stage.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: from, clientY: 100, bubbles: true }));
      stage.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: to, clientY: 104, bubbles: true }));
      fixture.detectChanges();
    };
    swipe(300, 180);
    expect(cmp().index()).toBe(1);
    swipe(180, 300);
    expect(cmp().index()).toBe(0);
    swipe(300, 280); // too short
    expect(cmp().index()).toBe(0);
  });

  it('remembers the step and resumes there', async () => {
    await open();
    key('ArrowRight');
    key('ArrowRight');
    expect(JSON.parse(localStorage.getItem('cwm.cook.v1.abc')!).v).toEqual({ step: 2, total: 3, name: 'Pad Thai' });
    dialog().close();
    fixture.destroy();
    el().remove();
    TestBed.resetTestingModule();

    await open(true, false);
    expect(cmp().index()).toBe(2);
    expect(text()).toContain('Toss everything together.');
  });

  it('the ingredients drawer shares its check-offs with the recipe page', async () => {
    await open();
    const toggle = el().querySelector('.cook__btn--mid') as HTMLButtonElement;
    const drawer = el().querySelector('.cook__drawer') as HTMLElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(drawer.hasAttribute('inert')).toBeTrue();
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(drawer.hasAttribute('inert')).toBeFalse();

    const checks = Array.from(drawer.querySelectorAll<HTMLButtonElement>('.check'));
    expect(checks.map((c) => c.textContent!.trim())).toEqual(['Noodles', 'Peanuts', 'Lime']);
    checks[1].click();
    fixture.detectChanges();
    expect(checks[1].getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem('cwm.checks.v1.abc')!).v.ingredients).toEqual([1]);
  });

  it('closing (✕ or Escape) emits closed, restores page scroll and releases the dialog', async () => {
    await open();
    const closed = jasmine.createSpy('closed');
    fixture.componentInstance.closed.subscribe(closed);
    (el().querySelector('[aria-label="Close Cook Mode"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dialog().open).toBeFalse();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('a missing Wake Lock API is skipped silently', async () => {
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'wakeLock');
    Object.defineProperty(Navigator.prototype, 'wakeLock', { configurable: true, get: () => ({ request: () => Promise.reject(new Error('denied')) }) });
    await open();
    await fixture.whenStable();
    expect(dialog().open).toBeTrue(); // no throw, still usable
    if (original) Object.defineProperty(Navigator.prototype, 'wakeLock', original);
    else delete (Navigator.prototype as any).wakeLock;
  });

  it('finish: a guest is sent to the existing login route; a signed-in cook saves through the existing endpoint', async () => {
    await open();
    cmp().go(3, 1);
    fixture.detectChanges();
    const login = el().querySelector('.cook__actions a') as HTMLAnchorElement;
    expect(login.getAttribute('href')).toBe('/login?returnUrl=%2Fview-recipe%2Fabc');

    TestBed.inject(AuthService).setSession(fakeJwt(), { username: 'a', email: 'a@b.co', role: 'User' });
    fixture.detectChanges();
    const save = el().querySelector('.cook__actions button.btn-cwm') as HTMLButtonElement;
    expect(save.textContent).toContain('Save to collection');
    save.click();
    http.expectOne(`${environment.apiUrl}/api/savedRecipe/abc`).flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el().querySelector('.cook__note')!.textContent).toContain('already in your collection'); // never a fake success
    http.verify();
  });

  it('with motion allowed a step change still lands on the right step (latest wins on rapid input)', async () => {
    await open(false);
    key('ArrowRight');
    key('ArrowRight');
    key('ArrowLeft');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(cmp().index()).toBe(1);
    expect(text()).toContain('Fry the garlic.');
    expect(el().querySelectorAll('.cook__panel:not([aria-hidden])').length).toBe(1);
  });
});
