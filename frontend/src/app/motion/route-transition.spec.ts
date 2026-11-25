import { TransitionContext, chooseDirection, chooseMode } from './route-transition';

describe('route transition mode', () => {
  const ctx = (over: Partial<TransitionContext> = {}): TransitionContext => ({
    fromPath: '/', toPath: '/all-recipes', sameRoute: false, reduced: false, hidden: false, morphArmed: false, ...over,
  });

  it('wipes between public routes', () => {
    expect(chooseMode(ctx())).toBe('wipe');
    expect(chooseMode(ctx({ fromPath: '/about', toPath: '/contact' }))).toBe('wipe');
    expect(chooseMode(ctx({ fromPath: '/all-recipes', toPath: '/view-recipe/abc' }))).toBe('wipe');
  });

  it('morphs only when a tile photo is armed and we are entering a recipe', () => {
    expect(chooseMode(ctx({ toPath: '/view-recipe/abc', morphArmed: true }))).toBe('morph');
    expect(chooseMode(ctx({ toPath: '/about', morphArmed: true }))).toBe('wipe');
  });

  it('does nothing for admin, in either direction', () => {
    expect(chooseMode(ctx({ toPath: '/admin' }))).toBe('none');
    expect(chooseMode(ctx({ fromPath: '/admin/recipes', toPath: '/admin/users' }))).toBe('none');
    expect(chooseMode(ctx({ fromPath: '/admin', toPath: '/' }))).toBe('none');
    expect(chooseMode(ctx({ toPath: '/administrator' }))).toBe('wipe'); // only the real admin area
  });

  it('does nothing for same-route param or query changes', () => {
    expect(chooseMode(ctx({ fromPath: '/all-recipes', toPath: '/all-recipes' }))).toBe('none');
    expect(chooseMode(ctx({ fromPath: '/view-recipe/a', toPath: '/view-recipe/b', sameRoute: true, morphArmed: true }))).toBe('none');
  });

  it('does nothing under reduced motion or in a hidden tab', () => {
    expect(chooseMode(ctx({ reduced: true }))).toBe('none');
    expect(chooseMode(ctx({ hidden: true, toPath: '/view-recipe/abc', morphArmed: true }))).toBe('none');
  });

  it('sweeps backwards for browser Back/Forward and for explicit back links', () => {
    expect(chooseDirection('popstate', undefined)).toBe('back');
    expect(chooseDirection('imperative', { vt: 'back' })).toBe('back');
    expect(chooseDirection('imperative', undefined)).toBe('forward');
    expect(chooseDirection('imperative', { vt: 'other' })).toBe('forward');
    expect(chooseDirection(undefined, null)).toBe('forward');
  });
});
