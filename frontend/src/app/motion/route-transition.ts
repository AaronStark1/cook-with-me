import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationStart, Router, ViewTransitionInfo } from '@angular/router';
import { MotionPrefs } from './motion-prefs';

export type VtMode = 'wipe' | 'morph' | 'none';
export type VtDir = 'forward' | 'back';

export interface TransitionContext {
  /** Path the user is leaving / entering, without query string or fragment. */
  fromPath: string;
  toPath: string;
  /** The same route config was matched on both sides (only params / query changed). */
  sameRoute: boolean;
  reduced: boolean;
  hidden: boolean;
  /** A recipe tile photo has been armed for a shared-element flight. */
  morphArmed: boolean;
}

const isAdmin = (path: string) => path === '/admin' || path.startsWith('/admin/');
const isRecipe = (path: string) => path.startsWith('/view-recipe/');

/**
 * The single place the route-transition mode is decided.
 *   none   admin routes, same-route param/query changes, reduced motion, hidden tabs
 *   morph  a recipe tile was just clicked and we are entering its detail page
 *   wipe   everything else between public routes
 */
export function chooseMode(c: TransitionContext): VtMode {
  if (c.reduced || c.hidden) return 'none';
  if (isAdmin(c.fromPath) || isAdmin(c.toPath)) return 'none';
  if (c.sameRoute || c.fromPath === c.toPath) return 'none';
  if (c.morphArmed && isRecipe(c.toPath)) return 'morph';
  return 'wipe';
}

/** Browser Back/Forward buttons and explicit "back" links sweep left → right. */
export function chooseDirection(trigger: string | undefined, info: unknown): VtDir {
  if (trigger === 'popstate') return 'back';
  return !!info && typeof info === 'object' && (info as { vt?: string }).vt === 'back' ? 'back' : 'forward';
}

/** `<a routerLink=".." [info]="BACK">` marks a link as a backwards navigation. */
export const BACK = { vt: 'back' } as const;

// ---- shared-element photo (tile → detail) ----------------------------------
const MORPH_NAME = 'recipe-photo';
let armed: { el: HTMLElement; id: string } | null = null;

/** Called by a recipe tile on click: only this photo carries the shared name, so it stays unique. */
export function armMorph(el: HTMLElement | null | undefined, id: string | undefined) {
  disarmMorph();
  if (!el || !id || typeof document === 'undefined' || !('startViewTransition' in document)) return;
  armed = { el, id };
  el.style.setProperty('view-transition-name', MORPH_NAME);
}

export function disarmMorph() {
  armed?.el.style.removeProperty('view-transition-name');
  armed = null;
}

/** The detail page asks: am I the landing spot for the photo in flight? */
export const morphTargetId = () => armed?.id ?? null;
export const MORPH_PHOTO_NAME = MORPH_NAME;

const path = (url: string) => url.split(/[?#]/)[0] || '/';
const deepest = (snapshot: ActivatedRouteSnapshot) => {
  let route = snapshot;
  while (route.firstChild) route = route.firstChild;
  return route;
};
const urlOf = (snapshot: ActivatedRouteSnapshot) =>
  '/' + snapshot.pathFromRoot.flatMap((r) => r.url.map((s) => s.path)).filter(Boolean).join('/');

let current: ViewTransition | null = null;

/** `withViewTransitions({ onViewTransitionCreated })` — runs in an injection context. */
export function onViewTransitionCreated({ transition, from, to }: ViewTransitionInfo) {
  const router = inject(Router);
  const prefs = inject(MotionPrefs);
  const root = document.documentElement;
  const navigation = router.getCurrentNavigation();
  const fromLeaf = deepest(from);
  const toLeaf = deepest(to);

  const mode = chooseMode({
    fromPath: path(urlOf(fromLeaf)),
    toPath: path(urlOf(toLeaf)),
    sameRoute: !!fromLeaf.routeConfig && fromLeaf.routeConfig === toLeaf.routeConfig,
    reduced: prefs.reduced(),
    hidden: document.hidden,
    morphArmed: !!armed,
  });

  current?.skipTransition(); // never stack: the latest navigation wins
  current = transition;

  const done = () => {
    if (current === transition) {
      current = null;
      root.removeAttribute('data-vt');
      root.removeAttribute('data-vt-dir');
      disarmMorph();
    }
  };

  if (mode === 'none') {
    // No mode attribute = no animation in motion.css, so the transition completes within a frame.
    // (Only a hidden tab is skipped outright: skipping rejects `ready`, which Angular logs in dev mode.)
    disarmMorph();
    root.removeAttribute('data-vt');
    root.removeAttribute('data-vt-dir');
    if (document.hidden) transition.skipTransition();
  } else {
    if (mode !== 'morph') disarmMorph();
    root.setAttribute('data-vt', mode);
    root.setAttribute('data-vt-dir', chooseDirection(navigation?.trigger, navigation?.extras.info));
  }

  // a new navigation must never wait for the old transition
  const sub = router.events.subscribe((event) => {
    if (event instanceof NavigationStart && current === transition) transition.skipTransition();
  });
  transition.finished.then(done, done).finally(() => sub.unsubscribe());
}
