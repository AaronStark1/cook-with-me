import { TestBed } from '@angular/core/testing';
import { RecipeProgress } from './recipe-progress';

describe('RecipeProgress', () => {
  const clear = () => Object.keys(localStorage).filter((k) => k.startsWith('cwm.')).forEach((k) => localStorage.removeItem(k));
  beforeEach(clear);
  afterEach(clear);
  const make = () => {
    TestBed.resetTestingModule();
    return TestBed.inject(RecipeProgress);
  };

  it('toggles ingredients and steps per recipe and persists them', () => {
    const progress = make();
    progress.toggle('r1', 'ingredients', 2);
    progress.toggle('r1', 'ingredients', 0);
    progress.toggle('r1', 'steps', 1);
    progress.toggle('r2', 'ingredients', 5);
    expect(progress.checks('r1')).toEqual({ ingredients: [0, 2], steps: [1] });
    expect(progress.isChecked('r1', 'ingredients', 2)).toBeTrue();
    expect(progress.isChecked('r2', 'ingredients', 2)).toBeFalse();

    expect(make().checks('r1')).toEqual({ ingredients: [0, 2], steps: [1] }); // a fresh session reads it back
  });

  it('un-toggles, resets, and removes the entry when nothing is left', () => {
    const progress = make();
    progress.toggle('r1', 'ingredients', 1);
    progress.toggle('r1', 'ingredients', 1);
    expect(progress.hasAny('r1')).toBeFalse();
    expect(localStorage.getItem('cwm.checks.v1.r1')).toBeNull();

    progress.toggle('r1', 'ingredients', 1);
    progress.toggle('r1', 'steps', 0);
    progress.reset('r1', 'ingredients');
    expect(progress.checks('r1')).toEqual({ ingredients: [], steps: [0] });
    progress.reset('r1');
    expect(progress.hasAny('r1')).toBeFalse();
  });

  it('survives blocked storage', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    const progress = make();
    expect(() => progress.toggle('r1', 'steps', 3)).not.toThrow();
    expect(progress.isChecked('r1', 'steps', 3)).toBeTrue();
  });

  it('remembers the Cook Mode step and reports the latest session', () => {
    const progress = make();
    expect(progress.cookPosition('r1')).toBeNull();
    progress.setCookPosition('r1', { step: 2, total: 6, name: 'Pad Thai' });
    expect(make().cookPosition('r1')).toEqual({ step: 2, total: 6, name: 'Pad Thai' });
    expect(make().latestCook()).toEqual({ id: 'r1', position: { step: 2, total: 6, name: 'Pad Thai' } });
  });
});
