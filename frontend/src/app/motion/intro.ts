/**
 * Opening sequence — once per browser session, never under reduced motion.
 *
 * `armIntro()` runs before bootstrap and puts `intro-pending` on <html>, which
 * hides only the intro targets (see motion.css). `playIntro()` swaps it for
 * `intro-play`, which runs the staggered CSS animations and then gets out of
 * the way. A 3 s failsafe guarantees nothing can stay hidden.
 */
const KEY = 'cwm.intro.v1';
const PENDING = 'intro-pending';
const PLAY = 'intro-play';
/** Longest target: 650 ms delay + 1000 ms rise. */
const PLAY_MS = 1750;
const FAILSAFE_MS = 3000;

let claimed = false;

export function armIntro(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  try {
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  } catch {
    return; // storage blocked → no intro rather than an intro on every navigation
  }
  document.documentElement.classList.add(PENDING);
  setTimeout(playIntro, FAILSAFE_MS);
}

export const introPending = () => typeof document !== 'undefined' && document.documentElement.classList.contains(PENDING);

/** The hero says "I will start the intro when my fonts and first image are ready". */
export function claimIntro(): boolean {
  if (!introPending()) return false;
  claimed = true;
  return true;
}

export const introClaimed = () => claimed;

export function playIntro(): void {
  if (!introPending()) return;
  const root = document.documentElement;
  root.classList.replace(PENDING, PLAY);
  setTimeout(() => root.classList.remove(PLAY), PLAY_MS);
}

/** Resolves when fonts are ready or after `ms`, whichever is first. */
export function fontsReady(ms = 600): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts?.ready) return;
    fonts.ready.then(() => { clearTimeout(timer); resolve(); }, () => undefined);
  });
}
