import { PROGRESS_TTL_MS, ProgressStore } from './progress-store';

describe('ProgressStore', () => {
  const clear = () => Object.keys(localStorage).filter((k) => k.startsWith('cwm.')).forEach((k) => localStorage.removeItem(k));
  beforeEach(clear);
  afterEach(clear);

  it('round-trips values under versioned keys', () => {
    const store = new ProgressStore();
    store.set('checks', 'abc', { ingredients: [0, 2] });
    expect(localStorage.getItem('cwm.checks.v1.abc')).toContain('"ingredients":[0,2]');
    expect(new ProgressStore().get('checks', 'abc')).toEqual({ ingredients: [0, 2] });
    store.remove('checks', 'abc');
    expect(store.get('checks', 'abc')).toBeNull();
  });

  it('prunes entries older than 14 days and ignores corrupt ones', () => {
    const old = new ProgressStore();
    old.set('cook', 'stale', 3, Date.now() - PROGRESS_TTL_MS - 1000);
    old.set('cook', 'fresh', 5);
    localStorage.setItem('cwm.cook.v1.junk', '{not json');

    const store = new ProgressStore();
    expect(store.get('cook', 'stale')).toBeNull();
    expect(store.get('cook', 'fresh')).toBe(5);
    expect(localStorage.getItem('cwm.cook.v1.stale')).toBeNull();
    expect(localStorage.getItem('cwm.cook.v1.junk')).toBeNull();
    expect(store.list<number>('cook').map((e) => e.id)).toEqual(['fresh']);
  });

  it('lists newest first', () => {
    const store = new ProgressStore();
    store.set('cook', 'a', 1, Date.now() - 5000);
    store.set('cook', 'b', 2, Date.now() - 100);
    expect(store.list<number>('cook').map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('keeps working for the session when storage is blocked', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'removeItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'key').and.throwError('blocked');
    const store = new ProgressStore();
    expect(() => store.set('checks', 'x', [1])).not.toThrow();
    expect(store.get('checks', 'x')).toEqual([1]);
    expect(store.list('checks').length).toBe(1);
    expect(() => store.remove('checks', 'x')).not.toThrow();
    expect(store.get('checks', 'x')).toBeNull();
  });
});
