# Fable 5.2 Prompt: Cook With Me — Motion & Delight Pass

> Replaces the original UI-revamp brief. The editorial rebrand that brief asked for is **already built and committed** (`16d9ad3` on `feat/ui-revamp-editorial-brand`). This pass is **additive**: keep the tomato / cream / yolk / broth identity exactly as it is, and give it motion, depth, a showpiece "watch the dish come together" demo, and a handful of genuinely new interface features. Do not redo, re-theme or restyle anything that already works.

Act as a senior motion designer and Angular 20 engineer. You will make Cook With Me feel alive: a heavy plate sliding across a table, hard-edged poster colour sweeping across the screen, small tactile responses everywhere, and two or three features that make the app more useful in a real kitchen — not just prettier.

---

## 0. How to work

1. **Inspect first.** Read the files listed in §1 before editing. Run the baseline checks in §15.1 and record the numbers.
2. **Work in the phases in §14.** Each phase must leave the app building, all tests green and visually coherent. Do not start Phase N+1 with Phase N broken.
3. **Priorities.** `P0` = must ship in this pass (the signature set). `P1` = strong additions, do after P0. `P2` = stretch; each is independent, skip any that would compromise quality or budgets and say so in your report.
4. **Judgement over literalism.** Numbers in this brief that come from the Blendy reference (§3, §4.2) are measured and should be used as given. Layout coordinates and sizes marked *starting point* are untested guesses: compose by eye in a real browser, screenshot, iterate.
5. **Look at it.** This is a visual task. Run the app in a real browser and watch every animation at 1440×900, 820×1180, 390×844 and 360×640, with reduced motion on and off. Type-checking is not verification. If the backend/Mongo is not available, use a throwaway mock for `/api/allRecipes`, `/api/viewRecipe/:id`, `/api/relatedRecipe` kept **outside the repo** (a temp directory), never committed.
6. **Do not commit or push** unless asked.

---

## 1. Starting point — what exists (do not rebuild)

**Stack.** Angular 20.3.35, standalone components, zone.js with `eventCoalescing`, `provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' }))`, Bootstrap CSS (reset + grid only; its JS is not loaded), bootstrap-icons, `@fontsource` Dela Gothic One + Archivo Variable. **`@angular/animations` is not installed and must stay that way.** No animation library exists.

**Design system** — `frontend/src/styles.css`: tokens, `.band--paper|surface|broth|yolk|cream`, `.btn-cwm` (+ `--ink|broth|red|ghost|sm`), `.tag`, `.photo` / `.photo--offset` (hard yolk offset), `.kicker`, `.label`, `.numeral`, `.display-*`, forms, `.alert`, `.table`, `.state` / `.loader`, focus ring (broth inner + yolk outer).

**Components and pages to read before editing**
- `components/hero-carousel/*` — one `turns` signal drives everything. Dishes ride a ring via `rotate(θ) translateY(-R) rotate(-θ) scale(s)` with CSS transitions (`--dur: 1.15s`, `--wheel-ease: cubic-bezier(0.65,0.02,0.2,1)`); `FIELD_COLORS = ['#C8281C','#B4410E','#9B1B3C','#2F5A2E']` crossfade by opacity (0.9 s); `AUTOPLAY_MS = 5200`; pauses on hover/focus/hidden tab/user pause; no autoplay under reduced motion; ArrowLeft/Right inside the carousel group; polite live region for user-initiated changes. Its spec is 286 lines.
- `components/navbar/*` (per-link `::after` yolk bar, `display:none` account menu and mobile panel), `components/footer/*`, `components/recipe-tile/*`, `directives/img-fallback.ts`, `models/recipe-model.ts`, `models/recipe-meta.ts`.
- `pages/home`, `pages/all-recipes`, `pages/view-recipe`, `pages/about`, `pages/contact`, `pages/login`, `pages/register`, `pages/auth/auth.css`, `pages/saved-recipes`, `pages/profile`, `pages/not-found`, `admin/*`, `app.html`, `app.ts`, `app.config.ts`, `app.routes.ts`.

**Data reality — design for this, not for an imagined API.** A recipe has only: `_id, name, ingredients[], instructions[], prepTimeMinutes, cookTimeMinutes, servings, difficulty, cuisine, caloriesPerServing, image, mealType[]`. Recipe photos are **remote URLs with arbitrary backgrounds — not transparent cut-outs**, and any can fail (→ `assets/plate.svg` via `appImgFallback`). Every effect must look intentional with plain square/circular crops, with the plate fallback, and with 0, 1, 2, 5 and 20 recipes.

**Baseline numbers (measured before this brief was written)**
- `npx ng build --configuration production`: clean, **initial total 767.64 kB** (budget: warn 850 kB / error 1 MB), `styles` 325 kB (mostly Bootstrap). Lazy chunks: `view-recipe` 13.7 kB, `admin-module` 39.6 kB, jsPDF chunks.
- Component CSS budget **8 kB warn / 12 kB error** per component. `hero-carousel.css` is ~8.9 kB of source (the build passes without a warning today, but it is the closest component to the line) — do **not** grow it. Put shared motion in global CSS (§4.3) or split the hero into sub-components.
- `npx ng test --watch=false --browsers=ChromeHeadlessCI`: **155 of 155 SUCCESS.**

**Hard constraints**
- Same stack and conventions. No new runtime dependencies: no GSAP, Framer Motion, Lenis, Lottie, AOS, Three.js, `@angular/animations`. Use CSS, the Web Animations API, `IntersectionObserver`, the View Transitions API, and Angular's built-in `animate.enter` / `animate.leave` (present in 20.3.35 — verify in a scratch component before relying on them).
- Do not change backend, API contracts, guards, validators, auth behaviour or business logic. Visual and interaction layers only.
- Existing specs stay green. If a spec breaks because markup legitimately changed, update the spec deliberately and say so in the report; never delete a test to get green.
- Content must **never** be invisible because JS, `IntersectionObserver`, the View Transitions API or a font failed. Animation is progressive enhancement over a complete, correct static page.

---

## 2. Brand lock — the reins

The identity is fixed. This is the single most important rule of the brief: **new motion and features must be unmistakably the same brand.**

**Colour — exactly the current tokens, no new hues.**

| Token | Value | Role |
|---|---|---|
| `--paper` | `#C8281C` | tomato page field |
| `--ink` | `#FFF3E0` | cream: text on red/broth/field colours, cream bands |
| `--surface` | `#A51F15` | deeper red blocks |
| `--yolk` | `#FFC93C` | accent: blocks, rules, focus, edges. **Never text on red.** |
| `--broth` | `#1C0F0A` | near-black: text on yolk/cream, dark bands |
| `--muted` / `--ink-soft` | `#FFE6DA` / `#5E4B43` | secondary text on red-or-broth / on cream |
| field colours | `#B4410E`, `#9B1B3C`, `#2F5A2E` | already in `FIELD_COLORS`; you may alias them as `--paprika`, `--beet`, `--basil` — same values, **not new colours** |

- Tints only through `color-mix(in srgb, <token> N%, transparent)` (already the pattern in the codebase).
- Contrast pairings are unchanged: cream on red/broth/every field colour, broth on yolk/cream. Decorative `aria-hidden` art is exempt from contrast, but it must never reduce the legibility of live text sitting over it.

**Type — exactly the current two families.** Dela Gothic One (display, uppercase headlines, numerals) and Archivo Variable (everything else). No third family. Using different Archivo weights is fine.

**Shape language.** Square corners, hard edges, solid rules, flat colour, hard offset shadows (`Npx Npx 0 <token>`). Circles are allowed **only** where the platter/plate motif already lives: hero platter and dishes, plate loader, 404 zero, Surprise-me wheel, and the Assembly Demo plate with its iris reveal (§5A).

**Soft effects — the complete allowed list:** the existing soft drop-shadow under hero dishes, depth-of-field blur on hero dishes and hero foreground props (§5), and in the Assembly Demo (§5A) a contact shadow (flat broth ellipse ≤25 % opacity, ≤4 px blur) plus static depth-of-field blur on its nearest ingredient tickets. **3D transforms (`perspective`, `rotateX/Z`) are allowed only in the Assembly Demo and the hero's pointer-tilt (§5.5).** Everything else is forbidden: **gradients (including shimmer skeletons, mask-image fades, gradient strokes), glows, glass / `backdrop-filter`, rounded pills and cards, neumorphism.** If an idea needs one of these, find the hard-edged equivalent (a flat translucent bar sweeping, a stepped pulse, a clip-path edge).

**Motion tone.** Confident, weighty, snappy-then-settling: slow to start, a rush through the middle, a long soft landing. Not bouncy, not springy, not floaty. Few big moves, many tiny fast ones. Motion may reinforce state; it must never be the only carrier of state.

---

## 3. What we take from the Blendy reference

The Blendy brief is a flavour-slider hero. We are not building a smoothie site — we are translating its best ideas into our language. **Only the right-hand column below is in scope.**

| Blendy | Translation for Cook With Me | Where |
|---|---|---|
| Measured panel wipe: 970 ms, slow start → rush → soft settle; old content drifts left 14 % while clipped; new content arrives with parallax starting at 50 % of the run | Same curve and maths, rendered with `clip-path` + `translate` | Hero field colour change, route transitions (640 ms), Cook Mode step change, saved-recipe removal |
| Five layers with different arrival factors (word .40, shadow .30, bottle .15, fruit .55, corner .75) | Depth layering: ghost word .40, platter .30, active dish (heaviest, moves least) .15, garnish .55, foreground props .75 | Hero |
| Huge white word behind the product | Huge **tonal cuisine word** behind the platter | Hero |
| Floating fruit bobs forever, random 3.2–5 s, random negative delay, ±7 px / ±3° | Flat garnish stickers around the platter bob the same way; **the active dish never bobs** (like the bottle) | Hero |
| Two big blurred corner pieces for depth | Two oversized blurred garnish props at the hero corners; rack-focus on the incoming dish | Hero |
| One underline that glides to the active tab (0.6 s, `cubic-bezier(.65,0,.35,1)`) | One yolk bar gliding between nav links | Header |
| Opening sequence: layers slide in at 0.9 s; UI rises staggered 250→650 ms via the separate `translate` property; 3 s failsafe | Same, once per session | Hero + header |
| Autoplay only when tab visible; any interaction pauses it 6 s; swipe >45 px and horizontal-dominant; ←/→ keys | Same rules on the hero (plus drag-to-spin) | Hero |
| Product shown from several angles; parts coming together into the whole product *(from the project owner's own description — no spec was supplied, so you have design freedom here; the §5A constraints are the contract)* | **Assembly Demo:** a recipe's real ingredients fly in, converge on a plate, the dish irises open, and a simulated camera orbits the plate | Home, §5A |

**Explicitly not borrowed:** the fixed 1440×900 `--u` design frame (the hero already scales in `cqw`; keep that), pastel palettes, Poppins/Baloo, **autoplay under reduced motion** (we keep today's behaviour: no autoplay), and the 2.6 s autoplay cadence (too fast to read a recipe — keep ~5.2 s).

---

## 4. The motion system — build once, reuse everywhere

### 4.1 Tokens

Add to a new global `src/motion.css` (register it in `angular.json` for both `build` and `test` `styles`) and mirror in `src/app/motion/tokens.ts`.

```css
:root {
  --ease:          cubic-bezier(0.2, 0.7, 0.2, 1);    /* existing — default UI easing */
  --ease-arrive:   cubic-bezier(0.22, 0.8, 0.3, 1);   /* openings, reveals, rises */
  --ease-glide:    cubic-bezier(0.65, 0, 0.35, 1);    /* sliding bars / indicators */
  --ease-out-quad: cubic-bezier(0.5, 1, 0.89, 1);     /* parallax arrival (k) */
  --ease-wipe:     cubic-bezier(0.65, 0.02, 0.2, 1);  /* fallback when linear() unsupported */

  --dur-micro: 120ms;  --dur-ui: 200ms;  --dur-reveal: 700ms;
  --dur-wipe-hero: 970ms;  --dur-wipe-page: 640ms;  --dur-wipe-step: 640ms;
}

/* The measured Blendy coverage curve as a CSS easing (38 sample points of the table below,
   smoothstep-interpolated between neighbouring table points). */
@supports (animation-timing-function: linear(0, 1)) {
  :root {
    --ease-wipe: linear(0, 0.003 1.6%, 0.006 3.1%, 0.009 8.3%, 0.012 13.4%, 0.0175 17%, 0.023 20.6%, 0.035 24.2%, 0.047 27.8%, 0.0585 30.9%, 0.07 34%, 0.0875 37.6%, 0.105 41.2%, 0.1187 43.6%, 0.1443 46.1%, 0.158 48.5%, 0.1808 50.5%, 0.2232 52.6%, 0.246 54.6%, 0.2935 55.5%, 0.398 56.5%, 0.5025 57.4%, 0.55 58.3%, 0.593 59.2%, 0.6875 60.1%, 0.782 61.1%, 0.825 62%, 0.8444 64.3%, 0.8806 66.7%, 0.9 69%, 0.92 74%, 0.94 79%, 0.948 82%, 0.956 85%, 0.9655 89%, 0.975 93%, 0.9875 96.5%, 1);
  }
}
```

### 4.2 The wipe — exact behaviour

Measured coverage `c(t)` (t = fraction of the run, c = how much of the *leaving* layer is covered), smoothstep `3k²−2k³` between neighbouring points. **Do not retune it.**

| t | 0 | .031 | .134 | .206 | .278 | .34 | .412 | .485 | .546 | .583 | .62 | .69 | .79 | .85 | .93 | 1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| c | 0 | .006 | .012 | .023 | .047 | .07 | .105 | .158 | .246 | .55 | .825 | .9 | .94 | .956 | .975 | 1 |

```ts
// src/app/motion/tokens.ts — single source of truth for JS; unit-test it.
const T = [0,.031,.134,.206,.278,.34,.412,.485,.546,.583,.62,.69,.79,.85,.93,1];
const C = [0,.006,.012,.023,.047,.07,.105,.158,.246,.55,.825,.9,.94,.956,.975,1];
const smooth = (k: number) => 3*k*k - 2*k*k*k;
export function cover(t: number): number {
  if (t <= 0) return 0; if (t >= 1) return 1;
  let i = 0; while (T[i + 1] < t) i++;
  return C[i] + (C[i + 1] - C[i]) * smooth((t - T[i]) / (T[i + 1] - T[i]));
}
// Test vectors: cover(.278)=.047  cover(.546)=.246  cover(.583)=.55  cover(.62)=.825  cover(.93)=.975  cover(1)=1
```

For a wipe over container width `W`, duration `D`, direction `dir` (`+1` forward / next, `−1` back / previous):

1. **Leaving layer is covered.** Forward: `clip-path: inset(0 c×100% 0 0)` (its right edge sweeps right → left). Back: `inset(0 0 0 c×100%)`. Animate `clip-path` between `inset(0)` and the fully-covered inset using `--ease-wipe` / `WIPE_EASING` as the animation's easing — the eased value *is* `c`.
2. **Leaving content drifts away:** `translateX(−dir × c × 0.14 × W)`, same duration and easing (so it is locked to `c`).
3. **Incoming content arrives with parallax.** Each incoming layer starts at `translateX(dir × factor × W)` and settles to 0. It starts at `0.5·D`, lasts `0.42·D`, eased with `--ease-out-quad`, fill-mode `backwards`; it lands at `0.92·D`. Per-layer `factor` is in §5.2.
4. **Latest wins.** If a new wipe is requested mid-flight, finish or cancel the old one to its end state first. Never leave a half-clipped layer on screen.
5. **Implementation.** WAAPI (`el.animate`) or CSS classes + custom properties. No `requestAnimationFrame` loop is needed for any wipe. Feature-detect `linear()`; fall back to `--ease-wipe` cubic-bezier.
6. **Leading edge.** Where the wipe is done in our own DOM (hero field, Cook Mode), a 6 px solid `--yolk` bar rides the clip edge (translated with the same easing). It is a hard stripe, not a glow.

### 4.3 Primitives to build (in `src/app/motion/` unless noted)

| Primitive | Purpose |
|---|---|
| `tokens.ts` | durations, easings, `WIPE_EASING`, `cover()`, `supportsLinearEasing()` |
| `MotionPrefs` service | live `reduced` **signal** (listens to the `prefers-reduced-motion` media query changes); the only place components read this |
| `wipe.ts` | `wipe(el, {dir, duration})`, `arrive(el, {factor, dir, width, duration})` returning cancellable promises |
| `appReveal` directive | one **shared** `IntersectionObserver`. Variants: `rise` (14 px + fade), `mask` (line/word mask rise), `wipe` (clip from left), `rule` (line draws via `scaleX`), `stagger` (children delay by index, capped at 8) |
| `appFlip` directive | FLIP re-ordering for grids (WAAPI, 420 ms `--ease`, 18 ms stagger, cap 12 items) |
| `appCountUp` / `<app-odometer>` | number animations (§9, §8.3) |
| `appCursorTag` | cursor-following tag (§5.5) |
| `ScrollState` service | one passive scroll listener **outside NgZone**, rAF-throttled; signals `y`, `progress`, `direction`, `velocity` |
| `ProgressStore` | `localStorage` wrapper (try/catch everywhere; works when storage is blocked), versioned keys `cwm.<thing>.v1.*`, prunes entries older than 14 days |
| `<app-toasts>` + `ToastService` | §12 |
| `AssemblyTimeline` | §5A engine: one paused WAAPI master timeline per showcase item whose `currentTime` is set by a *driver* (scroll or player); pure phase maths, unit-tested |

**Where shared CSS lives:** `src/motion.css` (tokens, reveal states, keyframes, reduced-motion block, plate loader, skeleton, button press). Component-specific motion stays in the component's CSS only if it fits the 8 kB budget; otherwise split the component.

### 4.4 Reduced-motion contract

Read live through `MotionPrefs` and mirrored by a global `@media (prefers-reduced-motion: reduce)` block. **Reduced motion never removes information or function** — only motion.

| Feature | With `prefers-reduced-motion: reduce` |
|---|---|
| Hero wipe, ring rotation, parallax arrival | Instant swap (≤150 ms opacity at most); **autoplay stays off** (existing behaviour) |
| Opening sequence | None — everything visible at once |
| Bobbing, rotating rings, marquee, idle loops | Static |
| Scroll reveals, mask reveals | Content visible immediately |
| Count-up, odometer | Final value immediately |
| FLIP, `animate.enter/leave` | None |
| Route View Transition | None |
| Cursor tag, drag inertia | Off / no inertia (drag-to-spin still works) |
| Surprise-me wheel | No spin; result shown immediately |
| Assembly Demo (§5A) | No scroll-scrub, no autoplay, no pin: a static, fully assembled dish with the ingredient list visible; the user-triggered angle buttons apply their camera transforms instantly; free-drag orbit still works (no inertia) |
| Cook Mode step wipe | Instant swap |
| Toasts | Appear/disappear with no movement |
| Loader | Static plate (existing behaviour) |

### 4.5 Performance rules (hard gates)

- Animate **only** `transform` / `translate` / `scale` / `rotate`, `opacity`, `clip-path`. `filter` only for hero depth-of-field: static blur on resting neighbours/props is fine, but at most 2 elements may *animate* `filter` at once, for ≤600 ms. Never animate `width`, `height`, `top`, `left`, margins or `box-shadow` blur. One allowed exception: `grid-template-rows: 0fr → 1fr` for form-message reveals.
- `will-change` only while animating; remove on finish.
- All pointer/scroll/resize listeners are passive and registered **outside NgZone** (`NgZone.runOutsideAngular`); re-enter the zone (or use signals) only when state a template reads actually changes. One shared `IntersectionObserver`, one scroll listener.
- Idle loops (bob, marquee, rings) pause when the tab is hidden or the element is off-screen.
- With Chrome DevTools **4× CPU slowdown** on 1440×900 and 390×844: hero change, route wipe, Cook Mode step change and grid FLIP hold ≥50 fps, no long task >50 ms during the animation.
- **CLS ≤ 0.02** on every route. Reveals reserve their space; nothing shifts.
- Do not delay LCP: the intro may not hide content longer than ~1.2 s; failsafe at 3 s.
- Initial bundle must stay under the 850 kB warning (≈80 kB headroom; aim to add ≤40 kB raw to initial). **Lazy-load Cook Mode, the Surprise-me wheel and the Assembly Demo** with `@defer` or dynamic `import()`.
- Take a Lighthouse (mobile) run before you start and after you finish; Performance may not drop more than 5 points.

---

## 5. Home hero v2 — the signature moment (P0)

Keep the poster, the headline, the ring-of-dishes geometry, the `turns` signal and every accessibility behaviour that exists. Layer new depth around it and re-time the colour change as a wipe. The whole thing should feel like one gesture: the colour edge sweeps, the platter turns, the word and garnish slide in at different speeds, the info block rewrites itself.

### 5.1 Opening sequence — once per browser session

Gate with `sessionStorage` (`cwm.intro.v1`); skip entirely under reduced motion. To avoid a flash of final content followed by animation, set an `intro-pending` class on `<html>` before bootstrap (in `main.ts` or an inline script), which hides only the intro targets; remove it when the hero has played, when the fonts and first dish image are ready (≤600 ms wait), or at the **3 s failsafe**, whichever is first. Use the **separate `translate` property** for the rises so existing `transform`s are untouched.

| Element | Animation | Delay | Duration | Easing |
|---|---|---|---|---|
| Ghost word layer | `translateX` from +0.40·W → 0 | 0 | 900 ms | `--ease-arrive` |
| Platter + contact shadow | from +0.30·W | 0 | 900 ms | same |
| Active dish | from +0.15·W (moves least — it is the heaviest object) | 0 | 900 ms | same |
| Garnish | from +0.55·W | 0 | 900 ms | same |
| Foreground props | from +0.75·W | 0 | 900 ms | same |
| Headline | words mask-rise (translateY 105 % → 0 inside `overflow:clip` lines; pad for Dela Gothic ascenders), stagger 70 ms | 150 ms | 900 ms | same |
| Wordmark | fade + `translate 0 14px → 0` | 250 ms | 1000 ms | same |
| Nav links | same rise | 330 ms | 1000 ms | same |
| Kicker + lede | same rise | 330 / 410 ms | 1000 ms | same |
| Account actions, hero CTAs | same rise | 410 / 490 ms | 1000 ms | same |
| Info block | same rise | 570 ms | 1000 ms | same |
| Controls bar | same rise | 650 ms | 1000 ms | same |

If the first visit is a deep link (e.g. `/all-recipes`), only the header intro plays; the flag is still set so the hero doesn't replay later.

### 5.2 Layer stack (bottom → top)

| # | Layer | Content | Arrival factor | Idle | A11y |
|---|---|---|---|---|---|
| 1 | Field | flat `FIELD_COLORS` colour; wipe edge layer on top | — (wipes) | none | hidden |
| 2 | **Ghost word** | giant tonal word = `recipe.cuisine` (fallback `mealType[0]`, then first word of `name`), Dela Gothic uppercase, `color-mix(in srgb, var(--ink) ≤14%, transparent)` | **.40** | none | `aria-hidden` |
| 3 | Platter | existing broth disc + rings + a flat contact-shadow ellipse | **.30** | none (rotates on change, as today) | hidden |
| 4 | **Active dish + ring dishes** | existing ring mechanics, untouched | **.15** (active dish: does not bob) | none | existing |
| 5 | **Garnish** | 6–8 flat vector "stickers" (§5.3) | **.55** | **bob** | hidden |
| 6 | **Foreground props** | 2 oversized garnish glyphs bleeding off top-right and bottom-left corners, static blur ≈ 0.6 cqw (≈9 px @1440) | **.75** | slow bob | hidden |
| 7 | Poster type, info block, controls | existing | rise only | none | existing |

`W` = the hero's own width (container query unit `cqw`). On screens ≤820 px multiply every factor by 0.6 so nothing overshoots the viewport.

**Ghost word rules.**
- Right-anchored and bleeding off the right edge; its left edge never extends left of ~40 cqw, so it cannot sit under the lede/CTAs. Cap line centred on the platter's focal height.
- Fit it like Blendy fits words: measure with a canvas `measureText` (`actualBoundingBoxLeft + actualBoundingBoxRight`) after `document.fonts.ready`; shrink with a tighter letter-spacing when it would exceed its box. **Measure the cap height of the real font** — don't assume a ratio.
- Mobile: behind the stacked platter stage, centred, fitted to ~92 % of the visible width.
- Must pass a screenshot review: the headline remains clearly legible. If it doesn't, drop to a 2 px outline at ≤30 % ink.

### 5.3 Garnish stickers (flat vector, inline SVG sprite in a `garnish` component)

- A sprite of flat glyphs: chilli, basil leaf pair, lemon wedge (top-down), garlic clove, peppercorn trio, sesame scatter, rosemary sprig, mushroom slice, tomato slice (top-down), fried egg (cream oval + yolk centre).
- **Colours only from the tokens.** Each glyph must read on **all four** field colours: base fills from `--ink` / `--yolk` / `--broth`; `--paper` / `--surface` / basil only as accents on top of a cream or yolk base; a 3 px `--broth` keyline and a hard `4px 4px 0 var(--broth)` offset shadow (the same sticker language as `.photo--offset`). No gradients, no soft shadows.
- **P0:** two alternating garnish *sets* (A/B, swapped with parity like the existing `swap` signal), so each change slides one arrangement out and another in.
- **P1 (ingredient-aware):** choose glyphs by matching the active recipe's real `ingredients[]` text against a small dictionary (chilli/pepper, basil/herb, lemon/lime, garlic, mushroom, tomato, egg, sesame/peppercorn…). When ingredient data exists, never show an ingredient-specific glyph the recipe doesn't contain; fill leftover slots (or all slots, when nothing matches) with the neutral glyphs — peppercorn trio, sesame scatter, herb sprig.
- **Bob** (every garnish piece and the foreground props): `translateY(−0.5cqw) rotate(base−3°) ↔ translateY(+0.5cqw) rotate(base+3°)`, `alternate infinite ease-in-out`, duration random 3.2–5.0 s, delay random 0 to −4 s per piece (set once; stable across re-renders). Frozen under reduced motion.
- *Starting-point layout* (desktop, compose by eye, nothing may overlap headline, lede, CTAs, info block or controls): 3–4 pieces hugging the platter's upper-left and lower-right arc, 2–3 near the right edge, 2 foreground props at the corners. Mobile: 3 pieces.

### 5.4 Choreography when the active recipe changes (`dir` = ±1, one gesture, 970 ms)

Re-time the ring rotation to 970 ms and try `--ease-wipe` on it so wipe and rotation are one rhythm (fall back to the existing `--wheel-ease` if it looks wrong — judge in the browser).

1. **Field wipe.** The next colour is revealed by a clip-path edge: forward sweeps right → left, backward left → right, with the §4.2 curve and the 6 px yolk edge. The headline stays static and cream, on a flat colour before *and* after the edge — never on a blend.
2. **Ghost word** leaves (drift 0.14·W·c, clipped by the wipe) while the new word arrives (factor .40).
3. **Garnish and foreground props** do the same with their factors (.55, .75).
4. **Rack focus.** The incoming dish animates `filter: blur(5px) → 0` while growing .56 → 1; the outgoing dish `blur(0) → 3px` while shrinking; neighbours rest at ≈2 px blur (depth of field). Only the two animating dishes animate `filter`.
5. **Info block** rewrites: title lines mask-rise (60 ms stagger); meta tags stagger in (40 ms); the `01 / 05` count is an **odometer** (digits roll vertically); the "View recipe" button slides in last. Replace the current `hero-rise-a/b` keyframes.
6. **Dots.** The active dot grows into a wider yolk bar that **fills over the autoplay interval** (`transform: scaleX`), so users can see when the next advance will happen; it freezes when autoplay is paused. Hard-edged, no gradient.
7. **Rapid input.** Mashing next/prev must never glitch: latest wins (§4.2.4); the ring already uses a continuous `turns` value.

### 5.5 Interaction (P0 unless noted)

- **Drag / swipe to spin.** Pointer-drag on the platter rotates the lazy-Susan 1:1 (`dx / (0.5·W)` of a position) with the ring's transition disabled while dragging; on release snap to the nearest position, with one extra step on a fast flick (> ~0.5 px/ms). A drag counts as a swipe when horizontal travel > 45 px and larger than vertical travel. `touch-action: pan-y` so vertical page scroll is never hijacked; abandon the drag if the first movement is vertical. Never fire the dish link after a drag.
- **Autoplay rules:** every 5.2 s while visible; **any user action pauses it for 6 s**; also pause on hover (mouse only), focus, hidden tab, user pause button, and **when <30 % of the hero is in the viewport** (new). Keep the polite live region for user-initiated changes only.
- **Keyboard:** keep ←/→ inside the carousel group; Home/End jump to first/last.
- **Cursor tag (P1).** Over the active dish on `(hover: hover) and (pointer: fine)` devices, a square yolk tag "VIEW →" (broth text) follows the pointer with a light lerp (`appCursorTag`, one rAF loop only while hovering). Decorative; the link stays keyboard-focusable. Off under reduced motion.
- **Pointer tilt (P1).** The active dish tilts up to ±8° toward the pointer (`perspective` on the dish wrapper, `rotateX/Y`, eased, one rAF loop only while the pointer is over the hero, disabled during drags/wipes). Returns to flat on leave. Fine-pointer devices only; off under reduced motion.

### 5.6 Small screens

Keep the existing recomposition (stacked headline, platter stage, info + controls below). Parallax factors ×0.6; garnish 3 pieces; foreground props and ghost word per §5.2; drag-to-spin works with `touch-action: pan-y`; nothing overflows horizontally; controls stay ≥44 px; safe-area insets respected.

### 5.7 Structure

`hero-carousel.css` has almost no headroom. Split into `hero-stage` (platter, dishes, garnish, props) and `hero-info` (copy, meta, odometer, controls) sub-components, or move shared pieces to `motion.css`. Keep the public surface (`app-hero-carousel`, `[recipes]` input, `MAX_FEATURED`, `AUTOPLAY_MS`, `FIELD_COLORS`) and the class names the specs rely on, or update those specs deliberately.

---

## 5A. The Assembly Demo — "Watch it come together" (P0, the showpiece)

The catchiest moment in the app. On Home, directly under the strip, a small **fixed** set of featured recipes is *built on screen*: the dish's real ingredients fly in from every side, converge on an empty plate, the dish photo irises open from the centre, and a camera then orbits the plate through several angles before settling on the recipe name and a "Start cooking" button. It should make someone want to cook that exact dish.

**Honesty constraint that shapes everything:** each recipe has **one** photograph. The "angles" are a *simulated camera move around a single photo on a physical-looking plate*, not photographs of different sides of the food. No copy, label or alt text may imply otherwise. (If the recipe model ever gains multiple images, the orbit can cross-fade them — out of scope now; do not touch the backend.)

### 5A.1 Which recipes — "fixed featured items"
- `SHOWCASE_COUNT = 3`. A tiny config file exports `SHOWCASE_RECIPE_IDS: readonly string[] = []`. If the owner pins IDs there, those win. Otherwise `pickShowcase(recipes)` chooses **deterministically** (identical three for every visitor, no randomness): *eligible* = has `name`, `image`, ≥3 `ingredients`, ≥3 `instructions`; walk eligible recipes in API order, **preferring ones the hero isn't already featuring** and preferring distinct `cuisine` values; allow hero overlap only if there aren't enough otherwise.
- 0 eligible → render nothing (no dead UI, no empty band). 1–2 eligible → same sequence, shorter stepper.
- `pickShowcase` is a pure function with unit tests.

### 5A.2 Stage anatomy (bottom → top)
1. **Field** — flat `FIELD_COLORS` colour, rotating per item; item → item uses the §4.2 wipe (with the yolk edge).
2. **Ghost word** — the recipe name (first one or two words if long), tonal, same fitting and legibility rules as §5.2.
3. **Turntable** (the 3D object): wrapper `perspective: 1400px; perspective-origin: 50% 40%`; inside it `transform-style: preserve-3d` holding, from back to front: the contact shadow ellipse (z −12); **plate thickness** — ≤8 flat slices offset in Z, alternating `--ink` and a broth-tinted cream (`color-mix(in srgb, var(--ink) 88%, var(--broth))`), rendered **only while the plate is tilted**; the plate face (cream disc with the existing platter rings); the **dish photo** (circular crop with the same cream rim as the hero dishes); and **billboard garnish stickers** that counter-rotate to always face the camera.
4. **Ingredient tickets** — §5A.3.
5. **UI** — item stepper, player controls, angle chip, info block (§5A.6–5A.7).

### 5A.3 Ingredient tickets — the real ingredients
- One ticket per ingredient, **max 8** (the first 8; add a "+N more" ticket when there are more). They are real DOM: a `<ul>` of `<li>`s — **the tickets are the accessible ingredient list**; their animation is decorative transform only.
- Look: hard-edged cream (alternately yolk) block, Dela Gothic uppercase **name**, a small Archivo quantity label, broth text, −6°…+6° resting rotation, hard `4px 4px 0` offset shadow. Split quantity from name with a conservative parser ("2 tablespoons olive oil" → **OLIVE OIL** + "2 TBSP"); if it can't split with confidence, the whole string is the name. Build this as a shared, unit-tested pure util in Phase 2B — the §9.3 servings scaler reuses it, so don't write two parsers.
- **Depth tiers** (assign deterministically by index): *near* (scale 1.15, parallax .75, static 2–3 px blur — max 3 tickets), *mid* (1.0, .55), *far* (0.85, .40, sharp). Entry points spread around all four edges, computed from the index — **no randomness**, so the choreography is identical on every visit.
- Paths are **arcs, not straight lines** (use an intermediate keyframe, or `offset-path`). Gentle idle drift while they wait (reuse the garnish bob: ±0.5 cqw, ±3°, per-ticket duration 3.2–5 s, negative delays).
- **P1:** where the §5.3 ingredient dictionary matches, a small garnish glyph sticker rides on the ticket.

### 5A.4 Master timeline (per item: 8 000 ms; all phases are fractions so scroll scrubbing can reuse them)

| ms | Phase | What happens |
|---|---|---|
| 0–600 | **Set** | Field colour in place; empty plate arrives (parallax .30, `--ease-arrive`); ghost word mask-rises; `01 / 03` odometer |
| 600–2 600 | **Gather** | Tickets fly in along arcs from all sides, 120 ms stagger, at their depth tiers (Blendy factors .75 / .55 / .40) and settle into a loose scatter around the plate |
| 2 600–4 000 | **Converge** | Tickets spiral toward the plate centre (`--ease-glide`), shrinking to ~0.35 and rotating to 0°, each docking on the plate rim; at ~4 000 a hard burst of 8 small squares (yolk / cream / broth) marks the moment they join |
| 4 000–5 200 | **Build** | The dish photo **irises open** from the centre (`clip-path: circle()` 0 → 100 %, `--ease-wipe`, 900 ms) with a 6 px yolk ring as the leading edge; plate thickness extrudes (Z slices fan out 0 → 8 px); the small tickets slide out into a **left-hand column** and scale back up (parallax .40) — now they read as the ingredient list |
| 5 200–7 000 | **Orbit** | The camera moves through the angles in §5A.5 (`--ease-glide`); the shadow ellipse follows; billboards counter-rotate; the angle chip updates |
| 7 000–8 000 | **Present** | Name, meta tags (`recipeMeta`), "View recipe" and "Start cooking" rise with an 80 ms stagger; in the Explore state the hint tag appears |
| +970 | **Hand-off** | (only if another item follows) the §4.2 wipe carries the next item's field colour across while this item drifts away |

Before the iris opens the dish image must be decoded (`img.decode()`; preload the active and next item's images early). On failure fall back to the plate image with the same reveal. The timeline never waits longer than 600 ms for an image.

### 5A.5 Camera angles (a simulated orbit)

| Keyframe (% of Orbit) | `rotateX` | `rotateZ` | Chip label |
|---|---|---|---|
| 0 | 0° | 0° | TOP-DOWN |
| 33 | 58° | −28° | THREE-QUARTER |
| 66 | 66° | −62° | LOW |
| 100 | 0° | −360° (one full turn, back to flat) | TOP-DOWN |

Keep `rotateX` ≤ 68° so the photo stays recognisable. Starting values — tune by eye. The photo rides slightly above the plate face in Z so parallax between rim, photo and billboards is visible during the tilt. Everything is `transform`; no per-frame style writes beyond the timeline scrub.

### 5A.6 Drivers — one engine, two ways to drive it
The timeline is a paused set of WAAPI animations (`easing: 'linear'` at the master level, per-phase easings inside) driven by setting `currentTime = progress × total`. Two drivers:

- **Scroll driver** — viewport ≥1024 px, fine pointer, motion allowed. The section is a tall track (`height: calc(var(--n) * 160svh)`) with a `position: sticky` stage (`top: var(--header-h); height: calc(100svh - var(--header-h))`); scroll progress through the track sets `currentTime` — continuous and fully reversible. **No ancestor between the stage and the viewport may use `overflow: hidden|auto|scroll`** (that breaks `sticky`); clip inside the stage with `overflow: clip`. The first focusable element in the section is a **"Skip demo"** link that jumps past the track.
- **Player driver** — everything else, and whenever the user touches the controls. Plays **once** when ≥50 % of the stage is visible (never loops), pauses when off-screen or the tab is hidden. Controls row: ▶ / ⏸, a hard-edged **scrubber** (`role="slider"`, keyboard operable, `aria-valuetext` = the current phase name), item stepper `01 02 03` (jump to that item and play), and **Replay**. All ≥44 px.
- **Explore state** — at the end of an item, in either driver, the plate becomes draggable: drag spins Z freely and tilts X within 0–62°; arrow keys rotate ±15°, `Home` resets to top-down; a yolk hint tag reads "DRAG TO TURN THE PLATE". Inertia only when motion is allowed; `touch-action: none` on the plate only while dragging.
- **Reduced motion** — no pin, no scrub, no autoplay. Show the assembled dish with the ingredient list visible, the stepper, and three **angle buttons** (Top-down / Three-quarter / Low) that apply the static camera transform **instantly** on click.
- **Mobile (≤820 px)** — player driver; stage height `min(100svh − var(--header-h), 46rem)`; ≤5 tickets; 4 thickness slices; ghost word fitted to ~92 % width.

### 5A.7 Info, copy and links
Kicker "The demo", heading **"Watch it come together."** (no claims beyond that). Present phase shows the recipe name (display type), `recipeMeta()` tags, **View recipe** → `/view-recipe/:id` and **Start cooking** → `/view-recipe/:id?cook=1` (§9.2 deep link — harmless until Cook Mode lands in Phase 3, where it starts being honoured). Stepper dots/numerals follow the hero's visual language.

### 5A.8 A11y and performance
- Decorative layers `aria-hidden`; the ticket `<ul>` is real content; a polite live region announces only **user-initiated** changes ("Showing Margherita Pizza, 2 of 3" — never per scroll tick); pause/stop control satisfies WCAG 2.2.2; no flashing (the join burst is a single event).
- Lazy: `@defer (on viewport; prefetch on idle)` with a same-size placeholder so there is **no layout shift**.
- ≤~30 animated elements per item scene; thickness slices exist only while tilted; `will-change` only during playback; static blur only on ≤3 near tickets; scroll handler is passive, outside NgZone, rAF-throttled, and idle when the section is off-screen. **Gate:** with 4× CPU throttle the Orbit holds ≥50 fps at 1440×900.
- P2: a "Replay assembly" button near the detail-page photo, reusing the same component with a single recipe.

---

## 6. Shell — header, menu, footer

### 6.1 Header (P0)

- **One gliding yolk bar** replaces the per-link `::after` bars on desktop. A single element under the nav list takes the active link's `offsetLeft` as `translateX` and its width, moving over **0.6 s `--ease-glide`** on both. Hovering another link slides the bar to it as a preview; leaving returns it to the active link. Route changes glide it. Measure after `document.fonts.ready` and on `ResizeObserver`; **no animation on the first paint** (place it, then enable the transition). Active link keeps `aria-current="page"`.
- **Scroll progress.** A `--rule`-tall yolk bar on the header's bottom rule, `scaleX(progress)` from the left. Use `animation-timeline: scroll(root)` under `@supports`; otherwise the shared `ScrollState`. Present on every public page that scrolls; absent in admin.
- **"Stuck" state.** After ~8 px of scroll, the header gains a hard `0 6px 0 var(--broth)` drop. **Header height must not change** (`--header-h` drives sticky offsets and page `min-height`s — a shrinking header would shift content).
- **Wordmark hover:** the yolk "WITH ME" block slides 4 px right with a hard offset shadow (160 ms). Keyboard `:focus-visible` gets the same.
- **Account menu:** replace `display:none` toggling with a top→bottom `clip-path` wipe (200 ms) using `animate.enter` / `animate.leave`; items stagger 30 ms; Escape/outside-click/focus-return behaviour unchanged.

### 6.2 Mobile menu (P0)

The panel opens with a `clip-path` wipe from the top (360 ms `--ease-arrive`), links mask-rise with a 45 ms stagger, the three-bar icon morphs into an ✕ (hard lines rotating, 200 ms). Keyboard behaviour, focus return, `aria-expanded`, Escape and "does not cover content unexpectedly" are unchanged and must still pass their specs.

### 6.3 Footer (P1)

- The giant wordmark reveals on scroll-in: letters mask-rise with a 40 ms stagger, then the yolk "WITH ME" block wipes in from the left (500 ms).
- "Back to top ↑" square button in the base bar: smooth scroll (instant under reduced motion), arrow nudges up on hover. Footer link hover: hard underline draws from the left.

### 6.4 Home strip → velocity marquee (P1)

Turn the "Discover ■ Save ■ Cook" strip into a looping marquee of the same content. The track animates via WAAPI; its `playbackRate` follows scroll velocity and **reverses with scroll direction**, eased back to base speed; the yolk squares rotate 90° per cycle. Duplicate the track for the seamless loop and mark the duplicate `aria-hidden`; the real words stay as one accessible instance. Static (today's strip) under reduced motion. Pauses off-screen.

---

## 7. Page transitions (P0)

Enable the View Transitions API through the router:

```ts
provideRouter(routes,
  withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
  withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated: /* choose mode, §7.1 */ }))
```

- **The header never moves.** Give the sticky header its own `view-transition-name` (`site-header`) and give `<main>` `view-transition-name: page`. Only `page` wipes; the header stays rock-still and the footer travels with the page.
- **Wipe mode** (default between public routes): `::view-transition-old(page)` is clipped and drifts per §4.2 over **640 ms** (`--dur-wipe-page`) with `--ease-wipe`; `::view-transition-new(page)` arrives with factor 0.15 per §4.2.3. Forward navigation sweeps right → left; **back** (`navigationTrigger === 'popstate'`, or the "Back to recipes" link) sweeps left → right. If a 6 px yolk edge can be done cleanly with the pseudo-elements do it; if not, skip it — don't hack.
- **Morph mode** (recipe tile → recipe detail and back): a **shared-element transition** on the recipe photo. Assign a `view-transition-name` **only** to the clicked tile's photo and to the detail page's photo (names must be unique — set it on click and clear it when the transition finishes). The photo flies from its grid position to the sticky feature position while the rest wipes.
- **None mode:** all `/admin` routes, same-route param/query changes (filters, search), `prefers-reduced-motion`, and hidden tabs. Admin must feel instant.
- Mode selection lives in one place and is set as `data-vt="wipe|morph|none"` on `<html>` so CSS can key off it.
- **Never block the user.** Call `transition.skipTransition()` if another navigation starts. A route transition must not outlast ~700 ms. Guarded/redirected navigations (`authGuard`, 404) must not leave a half-wiped screen.
- **Unsupported browsers:** no transition, no polyfill — routes simply swap.
- **Focus and announcements.** After each navigation, move focus to `<main id="main" tabindex="-1">` without a scroll jump and announce the new page title in a visually-hidden polite live region. Don't steal focus on same-route query changes. The skip link keeps working.

---

## 8. Browse — tiles, home sections, index, Surprise me

### 8.1 `RecipeTile` (P0)

- **Scroll reveal:** the photo reveals with a clip-path wipe (top → bottom, 650 ms), title and meta rise 80 ms later; stagger by index within the visible batch, capped at 8 × 60 ms.
- **Image load wipe:** `ImgFallback` marks `is-loaded` (also handle `img.complete` for cached images); the photo sits on its `--surface` field and the image wipes in from the left over 600 ms. A failed image falls back to the plate with the same reveal.
- **Hover / focus-visible** (identical for keyboard): keep the lift + hard offset shadow; add a **yolk "COOK THIS →" band** that slides up from the photo's bottom edge (260 ms `--ease-arrive`); the numeral block nudges; the title underline draws from the left. No cursor tag on tiles — the band is enough.
- Reduced motion: no reveals, no band slide (band is simply shown on hover/focus).

### 8.2 Home sections (P0)

Home order is: hero → strip/marquee → **Assembly Demo (§5A)** → "Cook this week" tiles → testimonials → CTA.

- Section heads: the kicker's rule draws left → right, headings mask-rise by line, the head's bottom `--rule` draws across (`scaleX`). "Cook this week" tiles reveal per §8.1.
- Testimonials: quotes stagger in (rise, 90 ms); the oversized quote mark scales/settles in; the left yolk rule grows (`scaleY`) as the quote appears.
- CTA band: headline words mask-rise; the button's arrow nudges 4 px on hover. Optional corner platter ring slowly rotating (scroll-linked via `animation-timeline` under `@supports`, otherwise static).
- Strip → marquee per §6.4.

### 8.3 Recipe index (`/all-recipes`) (P0)

- **Title** masks in; the count numeral is an **odometer** that rolls when filters change (accessible name is the real text, e.g. "12 recipes"; digit columns are `aria-hidden`).
- **Live filtering with FLIP.** Surviving tiles glide to their new grid positions (`appFlip`); entering tiles scale/rise in (`animate.enter`); leaving tiles clip-wipe out (`animate.leave`). Preserve the existing live search, filter semantics and `role="status"` result count. No animation on first load beyond the reveal.
- **Chips.** Selecting a chip **fills with yolk from the left** (180 ms, `scaleX`, origin left; origin right on deselect). Keep `aria-pressed`, the 44 px targets and the "Clear filters" behaviour.
- **Search.** `/` focuses the search box (ignored while typing in a field); `Esc` clears it when focused; a square clear (✕) button appears when there's text. **Match highlighting** in tile titles: a `<mark>` with a yolk background and broth text (12:1). The placeholder cycles a typed example built **only from real cuisines/meal types in the data** (static text under reduced motion; pause while focused).
- **Loading:** skeleton tiles (§12.2) instead of a bare spinner, keeping the visually-hidden "Loading recipes…" status text.
- Empty/error states: the plate loader/empty plate gently rocks once; retry button unchanged.

### 8.4 "Surprise me" — spin the platter (P0)

A square yolk button with a small platter glyph in the index header ("Surprise me"), plus the same action on the 404 page.

- Opens a lazy-loaded `<dialog>` (`showModal()`; Esc closes; focus trapped and returned). Inside, a lazy-Susan wheel of up to 8 **distinct recipes from the currently visible (filtered) set**, rotating around a ring.
- **Pick the winner first, then animate to it:** `winner = random(visible)`; total rotation = 3–4 full turns + the angle that lands the winner under a fixed yolk marker at 12 o'clock; 2.8 s `cubic-bezier(0.12, 0.8, 0.2, 1)`. Each dish passing the marker gives a 60 ms scale pulse (and `navigator.vibrate(8)` where supported).
- Lands on a result card: big photo, name, meta tags, **[Cook this]** (links to the real recipe route — morph transition applies), **[Spin again]**, **[Close]**. Never auto-navigate.
- <3 recipes: skip the wheel, just offer the suggestion. 0 recipes: button disabled with an explanatory label.
- A11y: the live region announces "Your surprise recipe: {name}"; wheel images are decorative. Reduced motion: no spin, show the result.

---

## 9. Recipe detail and Cook Mode

### 9.1 Detail-page upgrades (P0)

- **Entrance:** title mask-rises; fact numerals **count up** from 0 once on entering view (≈900 ms, ease-out, 80 ms stagger). Dela Gothic numerals aren't tabular, so reserve the final value's width (render the final text invisibly and overlay the counter) — no jitter. Facts with no data stay hidden, as today.
- **Photo:** keeps its sticky behaviour and hard yolk offset. Behind it, a dashed yolk platter ring peeks out and rotates **scroll-linked** (`animation-timeline: scroll()` under `@supports`, static otherwise) — a quiet echo of the hero. If the photo came from a tile, the morph transition lands it here.
- **Ingredient check-off.** The square yolk bullet becomes a real toggle button (`aria-pressed`, 44 px hit area): checked = solid yolk square with a hard tick that draws (`stroke-dashoffset`), the line text gains a 3 px line drawing left → right. Checked state **persists per recipe** in `ProgressStore`. A "Reset" text button clears it. Don't dim text below AA — strike and tick carry the state.
- **Method steps.** An `IntersectionObserver` marks the step crossing ~40 % of the viewport as *current*: a yolk left rule grows beside it and its numeral sits on a yolk block (broth text). A vertical broth rail along the list fills with yolk as the user progresses. Each step is also a toggleable "done" (same pattern as ingredients). Text stays at full contrast in every state.
- **Save button (success):** icon swaps to a filled bookmark, label slides to "Saved", 8 hard squares (yolk/cream/broth) burst 24 px outward and fade (400 ms), and a rotated (−6°) cream "SAVED" stamp slams in (scale 1.4 → 1, 120 ms, no bounce chain) and fades after 1.6 s. Keep the existing `alert` for the already-saved (409) and error cases. Under reduced motion: the label change only.
- **Download PDF:** during `downloading`, a hard-edged flat progress sweep (translating bar, not a gradient) runs across the button; on completion a "PDF ready" confirmation flashes. Behaviour unchanged.
- **Share (P1).** If `navigator.share` exists, a "Share" button calls it; otherwise it copies the link and shows a toast "Link copied". Real feature-detection, no invented fields.
- **Related recipes:** tiles reveal per §8.1.
- A primary **"Start cooking"** button (yolk) in the actions row opens Cook Mode (§9.2); hidden when there are no instructions.

### 9.2 Cook Mode — the flagship new feature (P0)

A distraction-free, big-type, step-by-step view for actually cooking. Lazy-loaded (`@defer (on interaction)` / dynamic import) so it costs nothing on first paint.

- **Container:** native `<dialog>` with `showModal()` (free focus trap + Esc); `aria-labelledby` the recipe name; full-viewport; safe-area insets respected; body scroll locked while open. Support a `?cook=1` query param on the detail route that opens Cook Mode on load (the Assembly Demo's "Start cooking" button uses it); it must not affect other query handling.
- **Layout:** top bar — ✕ close, `STEP 03 / 07` in Dela Gothic numerals, and a row of hard squares for progress (done = yolk, current = cream, upcoming = outlined). Main — the step text in large Archivo (`clamp(1.5rem, 4vw, 3rem)`, comfortable measure) with an oversized Dela Gothic step numeral. Bottom bar — large (≥56 px) Previous / Next, an "Ingredients" button that raises a drawer listing ingredients with the same check-off toggles as §9.1.
- **Colour:** each step uses one of the `FIELD_COLORS` in rotation, cream text on every one (all ≥5:1). The final screen is broth/yolk.
- **Step change = the Blendy wipe**, direction-aware: Next sweeps right → left, Previous left → right, 640 ms, §4.2 maths. The leaving step drifts 0.14·W; the incoming numeral arrives with factor .55 and the text with .40, landing at 0.92·D. Latest-wins on rapid taps. Reduced motion: instant swap.
- **Input:** ←/→ keys, Space/Enter = next, Esc = close, swipe (>45 px, horizontal-dominant), on-screen buttons. All announced: a polite live region reads "Step 3 of 7: {text}".
- **Keep the screen awake:** request a Screen Wake Lock (`navigator.wakeLock.request('screen')`) on open, re-acquire on `visibilitychange`, release on close; silently skipped if unsupported (feature-detect, try/catch).
- **Persistence:** the current step is saved in `ProgressStore` (shared with §9.1 checks), so reopening resumes where the cook left off.
- **Finish:** a "NICE ONE." screen with a hard-square burst (same as the Save stamp), actions: "Save to collection" (existing `saveRecipeAPI`, signed-in only; otherwise the existing login route with `returnUrl`) and "Back to recipe".
- **Timers (P2, built inside Cook Mode only):** parse durations from the step's own text (`/(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i`, use the larger end of a range) and render a square "▶ 10 MIN" button under the step. Running timers appear in a dock (hard-edged, Dela Gothic digits); completion turns the dock yolk with broth text "TIME!", announces via an assertive live region, vibrates where supported, and plays one short Web Audio beep (only after a user gesture started the timer). Timers are cancelled when Cook Mode closes. No text → no timer; never invent durations.

### 9.3 Servings scaler (P2)

A − / + stepper on the Serves fact. Scales leading quantities in `ingredients[]` strings only when they can be parsed with confidence (integers, decimals, ranges like `1-2`, simple fractions, unicode fractions ½ ⅓ ¼ ¾ …); anything else — "to taste", "a pinch", unparseable lines — is left untouched. Round to the nearest ¼ under 10, whole numbers above. The numeral rolls (odometer). Show "Scaled from {n} servings" with a reset. `caloriesPerServing` is per serving and does not change; times do not scale. Pure, unit-tested parser in `motion/` or `models/`.

---

## 10. Supporting routes

### 10.1 Auth — login and register (P1)

- Platter rings rotate slowly (dashed ring counter-rotating, ~60 s linear) and shift ≤8 px with the pointer on fine-pointer devices; static under reduced motion.
- Field focus lifts the input with a hard `4px 4px 0 var(--yolk)` offset (the existing focus ring stays). Invalid submit: a 240 ms three-step horizontal shake (±4 px) on the invalid field and the message block expands via `grid-template-rows` (not height).
- **Password show/hide** toggle (square button, `aria-pressed`, accessible name "Show password"/"Hide password").
- Submit shows the plate loader inside the button with stable width; success relies on the route wipe. Validation, errors, `returnUrl` and submit logic untouched.
- P2: a 4-square password strength meter on Register (visual only; validators unchanged).

### 10.2 Not found (P1)

The plate "0" **rolls in** from the left (translateX + rotate, ~1.4 s `--ease-arrive`) and settles between the 4s with a damped wobble; hover/click gives it a quick spin. Add the "Surprise me" action (§8.4) alongside the existing buttons.

### 10.3 About (P1)

Story numeral slides in from the left on scroll; "How it works" columns stagger and their yolk numerals slide up; the hero platter drifts and rotates scroll-linked. No scrubbed text (low-contrast intermediate states would fail AA).

### 10.4 Contact (P1)

Field focus lift as in §10.1; testimony success gets the "SENT" stamp (same as Save); keep all validation and messages.

### 10.5 Profile and Saved recipes

- **Profile (P1):** avatar initial drops in and settles; downloaded-recipe rows slide in with a 40 ms stagger (cap 10); success message gets the "UPDATED" stamp.
- **Saved recipes (P1):** removing a tile clip-wipes it out (360 ms, §4.2 curve) and the grid FLIPs closed; the "N saved" tag becomes an odometer; the empty state's plate rocks once. **P2:** a toast with "Undo" that re-saves through the existing `saveRecipeAPI(recipeId)` (note the list uses `recipe._id` for the saved-record id and `recipe.recipeId` for the recipe route — check which is which). If undo fails, show an error toast; never fake success.

### 10.6 "Continue cooking" band on Home (P2)

If `ProgressStore` holds progress for a recipe (a Cook Mode step or checked items) from the last 14 days, show a slim yolk band above the strip: "Pick up where you left off — {recipe name}, step {n} of {total}", linking to the recipe. Fetch the recipe through the existing `viewRecipeAPI`; hide the band on any failure.

---

## 11. Admin — restrained (P1)

Admin is a working tool. Keep it quick: every admin animation ≤200 ms, none on route change (`data-vt="none"`).

- Dashboard stat numerals count up once on load; stat blocks reveal with a 60 ms stagger.
- Table rows fade/slide in (25 ms stagger, only the first 10; no stagger over 50 rows). Row hover: a 6 px yolk left edge slides in.
- Sidebar: the active-link indicator **glides** between items (same single-bar pattern as the header, vertical).
- Moderation actions (approve/reject/delete): after the API succeeds, the row clip-wipes out (360 ms) and the table closes the gap. No optimistic removal before success.
- Keep every confirmation dialog, error message and table responsiveness exactly as they work today.

---

## 12. Global feedback

### 12.1 Plate loader (P0)

Restyle the existing `.loader` in global CSS (class name and size unchanged so no template edits): a cream disc with a yolk centre and a dashed ring that rotates (~1 s linear). Static under reduced motion. The `role="status"` and text in templates stay.

### 12.2 Skeletons (P0)

`.skeleton` blocks: flat `--surface` on paper/broth bands, a flat broth-tinted cream (`color-mix(in srgb, var(--broth) 10%, var(--ink))`) on cream bands, with a **flat translucent bar sweeping across** via `transform` (ink ~20 % on dark bands, broth ~8 % on cream) — no gradient. Used for tile grids on Home and the Index while loading, and the recipe-detail head. Keep a visually-hidden status text.

### 12.3 Buttons and links (P0)

- `.btn-cwm`: on hover keep the colour inversion and add a hard `4px 4px 0` offset (colour from a per-band variable: broth on paper/cream/yolk, ink on broth) with `translate(-2px,-2px)`; on `:active` it presses flat (`translate(0)`, shadow collapses). Arrow icons inside nudge 4 px right on hover. Disabled buttons don't animate.
- Inline text links: the underline draws in from the left on hover (background-size on a hard line) instead of the thickness jump.
- Every interactive control keeps ≥44 px targets and the existing focus ring; hover and `:focus-visible` get equivalent treatment.

### 12.4 Toasts (P1)

`ToastService` + `<app-toasts>` in the app shell: hard-edged broth block, 8 px yolk left edge, cream text, optional action button. Bottom-left on desktop; full width above the safe-area inset on mobile. Enter: slide from the left with `--ease-arrive` (420 ms); leave: clip-wipe. Auto-dismiss at 5 s, paused on hover/focus; `role="status"` (errors: `role="alert"`). **Use toasts only where there is no feedback today** (copy link, undo, timer done). Do **not** duplicate existing inline `.alert` messages, or screen-reader users will hear everything twice.

---

## 13. Data honesty

Nothing may be fabricated. No ratings, likes, authors, prices, "trending", counts or times that the record doesn't contain.
- Ghost word ← `cuisine` (then `mealType[0]`, then first word of `name`).
- Garnish ← the recipe's own `ingredients[]` text (generic set when nothing matches).
- Timers ← durations written in the step text. Servings scaler ← quantities written in ingredient text, parsed conservatively.
- Surprise me ← the currently visible recipes. Continue-cooking ← what the user actually did, stored locally.
- Assembly Demo ← the recipe's own `ingredients[]` (tickets), `image` (one photo) and `instructions`/`ingredients` counts (eligibility). The camera orbit is simulated: never imply extra photographs, other sides of the food, or ingredient quantities beyond what the text says.
- If a field is missing, hide the element (as the app already does) rather than show a placeholder.

---

## 14. Plan — files and phases

**New files (suggested):** `src/motion.css`; `src/app/motion/{tokens,wipe,motion-prefs,reveal,flip,count-up,cursor-tag,scroll-state,progress-store}.ts`; `components/{toasts,odometer,garnish,hero-stage,hero-info,cook-mode,spin-overlay,marquee,assembly-demo}/…` (plus `motion/assembly-timeline.ts` and a tiny `showcase.config.ts` exporting `SHOWCASE_COUNT` / `SHOWCASE_RECIPE_IDS` / `pickShowcase`). Register `motion.css` in `angular.json` build **and** test `styles`.

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 Foundation** | tokens, `motion.css`, `MotionPrefs`, `cover()` + tests, `wipe()/arrive()`, `appReveal`, `ScrollState`, `ProgressStore`, plate loader, skeletons, button press (§4, §12.1–12.3) | Build + 155 specs green; no visual regressions on any route |
| **1 Signature** | opening sequence, hero v2, header glide/progress/stuck/menus, route transitions (§5–§7; the Assembly Demo follows in 2B) | Hero change reads as one gesture; route wipe + morph work; reduced-motion contract verified |
| **2 Browse** | tiles, home sections, index (odometer, FLIP, chips, search, highlight), Surprise me (§8) | Filtering glides; wheel lands on its winner; 0/1/2/5/20 recipes all fine |
| **2B Assembly demo** | `AssemblyTimeline`, `pickShowcase`, tickets, turntable + camera orbit, scroll and player drivers, Explore state, reduced-motion static view (§5A) | Demo plays start-to-finish in both drivers, scrubs backwards cleanly, lands the same three recipes every visit, passes the 4× throttle gate; section is absent (no layout gap) with 0 eligible recipes |
| **3 Cook** | detail upgrades, check-offs, step rail, save/download feedback, Cook Mode, share (§9) | Cook Mode usable one-handed on 390×844; resume works; wake lock degrades silently |
| **4 Supporting** | auth, 404, about, contact, profile, saved, footer, marquee, cursor tag, toasts (§6.3–6.4, §10, §12.4) | Every route feels like one product |
| **5 Admin** | §11 | Admin still instant, dense and legible |
| **6 Hardening** | §15 verification, perf pass, a11y audit, README "Motion system" section, delete dead CSS/keyframes | All gates in §16 pass |

---

## 15. Verification

### 15.1 Baselines (before you change anything)
`npx ng build --configuration production` (note initial total and any warnings), `npx ng test --watch=false --browsers=ChromeHeadlessCI` (155 of 155), one mobile Lighthouse run of `/`.

### 15.2 Tests to add
Unit-test the **pure** logic: `cover()` (vectors in §4.2), wipe/arrive keyframe maths, garnish selection, ghost-word fitting maths, ingredient/step progress store (including storage-blocked), duration parser, quantity scaler, odometer digit maths, route-transition mode selection (back vs forward, admin, same-route), Surprise-me winner landing angle, `pickShowcase` (determinism, eligibility, hero-overlap preference, 0/1/2/3+ eligible), ticket name/quantity splitting, ticket depth-tier and entry-point assignment (deterministic), assembly phase boundaries (`progress → phase`), scroll-vs-player driver selection. Component/directive specs for reveal and FLIP **reduced-motion behaviour**, Cook Mode keyboard and focus handling, autoplay pause rules (6 s after interaction, <30 % visibility, hidden tab). Existing specs updated only where markup legitimately changed.

### 15.3 Manual matrix
- Viewports: 1440×900, 1024×768, 820×1180, 390×844, 360×640, 844×390 (short landscape).
- States: reduced motion **on and off**; 4× CPU throttle; API returning 0, 1, 2, 5, 20 recipes, a recipe with a broken image, and an error; signed in / signed out / admin.
- Interactions: rapid next/prev mashing on the hero; drag-spin with mouse and touch; keyboard-only through hero, nav, index, Cook Mode and the Surprise-me dialog; screen-reader pass (VoiceOver) on hero, Cook Mode, filters and route changes; browser Back/Forward through wipe and morph transitions; a browser without View Transitions or `linear()` (must degrade gracefully, not break).

---

## 16. Acceptance checklist

- [ ] No colour or font outside §2 anywhere; no gradient, glow, glass or rounded pill introduced (grep `gradient`, `backdrop-filter`, `border-radius`, `box-shadow … blur` in changed files).
- [ ] Hero: the first frame is complete with animation disabled; one change plays as a single 970 ms gesture (edge sweep, ring turn, word/garnish/props at their own speeds, info rewrite); forward and back are mirrored; mashing next/prev never glitches.
- [ ] `cover()` matches the table; the CSS `linear()` curve and the JS curve agree.
- [ ] The ghost word never harms headline legibility and never overflows; long cuisine names fit.
- [ ] Autoplay: pauses 6 s after any interaction, on hover/focus/hidden tab/<30 % visible; **never** runs under reduced motion.
- [ ] Header: one yolk bar glides on route change and hover; no motion on first paint; header height never changes on scroll.
- [ ] Route transitions: wipe between public routes (mirrored on Back), shared-element morph tile ↔ detail photo, nothing on admin or reduced motion; never longer than ~700 ms; focus lands on `main`.
- [ ] Index filtering glides (FLIP) with correct counts, highlighting, `/` shortcut; Surprise me always lands on the recipe it chose.
- [ ] Detail: counters don't jitter; check-offs persist per recipe and survive blocked storage; save stamp and download progress work and don't alter the existing behaviours.
- [ ] Cook Mode: works with keyboard, swipe and buttons; wipe direction follows Next/Previous; resumes; wake lock degrades silently; focus trapped and restored.
- [ ] Assembly Demo: the same three recipes appear on every load; tickets show the recipe's real ingredients (≤8, "+N more" beyond); Gather → Converge → Build → Orbit → Present plays in order in the player driver and scrubs smoothly **forwards and backwards** in the scroll driver; the dish irises open only after its image is decoded (or plate fallback); `sticky` pinning works (no clipped ancestor); "Skip demo" works; Explore drag/keys work; no copy implies extra photos; the section is absent with 0 eligible recipes and causes no layout shift while deferred.
- [ ] Reduced-motion contract (§4.4) verified feature by feature.
- [ ] `ng build --configuration production` has no new warnings; initial bundle <850 kB; Cook Mode and the wheel are lazy chunks; no component CSS over budget.
- [ ] All 155 original specs still pass (or are deliberately updated), plus the new ones.
- [ ] CLS ≤0.02 on every route; Lighthouse mobile Performance within 5 points of baseline; 4× throttle holds ≥50 fps on the main animations.
- [ ] No horizontal overflow at any tested viewport; every control ≥44 px and visibly focusable.
- [ ] No fabricated data anywhere (§13).

---

## 17. Final report

When finished, summarise: (1) what shipped per phase, with the key files; (2) the hero choreography as built and any deviations from §5 and why, plus the Assembly Demo as built (which three recipes `pickShowcase` chose from the data you tested with, which driver ran where, final timeline timings, measured fps at 4× throttle) and any deviations from §5A; (3) which P1/P2 items were skipped or partial, and why; (4) the before/after numbers — bundle size, test count, Lighthouse, any frame-rate findings; (5) data limitations you hit (e.g. recipes without images, empty `ingredients`); (6) anything you could not verify (browsers, devices, screen readers) — say so plainly; (7) follow-ups worth doing next.
