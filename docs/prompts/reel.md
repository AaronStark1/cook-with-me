# Prompt: the Cook With Me reel (45 s, filmed from the running app)

You are a senior motion designer and a pipeline engineer working in the **cook-with-me** repo (`/Users/aaron.correya/Development/cook-with-me`). Build a **45-second reel** that walks through and demos the real app with the dishes at the centre of every shot, and ship it in three cuts: a **16:9 master**, a **README web cut** and a **9:16 vertical cut** for social. Hold it to the production standard of the SpecShield QA reel and reuse that pipeline, adapting it where this app needs something different.

The reel must be **filmed from the running Angular app**: real UI, real motion, real recipe data. Nothing in it may be mocked up as UI. Animated graphics drawn by the reel itself (title, transitions, cursor, captions, end card) must be plainly reel graphics, never fake app screens.

**This is a one-shot run.** The user starts it and expects the finished reel at the end, with no check-ins. Never stop to ask for confirmation, wait for approval between steps, or end with a plan instead of outputs.
- Work through §12 in order, verifying each step yourself.
- When a check fails, fix it and re-check. If it still can't be made to work, take the fallback named in this brief and carry on.
- If there is no named fallback, choose the simplest honest alternative that keeps the brand rules, and record it in the final report.
- Stop early only for something outside your control, such as the API or app not starting. Even then, finish everything that doesn't depend on it.

Do not commit or push. **Do not change any app code** (`frontend/src`, `backend/`). If a shot seems to need an app change, work around it in `tools/showreel/` (film it differently, or cut the moment) and note it in the final report. Never add a hook to the app.

---

## 1. Read first

**The reference pipeline: SpecShield QA** (`/Users/aaron.correya/Development/HacktoberFest/specshield-qa/showreel/`). Read all of it before writing code:
- `lib/vclock.js`: virtual time (timers, rAF, `performance.now`, `Date`, `Event.timeStamp`, WAAPI pinning, video seeking).
- `capture.mjs` and `shots.mjs`: filming shots at 180 fps subframes under virtual time; cursor keys with eased, bowed paths; clicks; scroll; events; anchors recorded into `meta.json`; failing on stray hosts.
- `showreel.html`: the WebGL2 compositor. It covers `SEGMENTS`/`CUTS`/`CAMERA`, the 3-subframe × 4-camera-sample motion blur, transition shader modes, 2D overlays, the monotone-cubic camera, `renderFrame(k)` and `renderAudio()`.
- `lib/score.js`: the OfflineAudioContext score, sound design placed on picture events, sidechain, normalisation and the WAV encoder.
- `render.mjs`: parallel frame rendering, review modes (`--beats`, `--at`, `--range`, `--audio`, `--encode`), the BT.601 → BT.709 encode, and the two-pass web cut sized to a byte budget.
- `readme-media.mjs` and `record-showcase.mjs`: for context only.

A write-up of that reel's timeline and techniques is in `docs/prompts/reel-specshield-analysis.md`. Where it and the source disagree, the source is the authority.

**The closest prior art, already in this repo:** `tools/readme-media/` (committed in `74c4497`). It films this app's README clips with a virtual clock adapted from SpecShield. Read `readme-media.mjs` and `lib/vclock.js`, and reuse what fits:
- **Its vclock:**
  - an epoch of 2026-11-25 18:30 UTC;
  - `finish()` once an animation reaches its end;
  - skipping scroll-driven animations;
  - pinning View Transition pseudo-elements;
  - `settleImages()`, a real-time wait for on-screen images on every step.
- **Its data layer:**
  - `cachedAsset()` caches photos;
  - `FAKE_TOKEN` and `SESSIONS` give a signed-in session;
  - `mockFor()` answers every write and the signed-in GETs.
- **Its in-page cursor:** a top-layer popover, so it stays above native `<dialog>`s. The reel draws its cursor in the compositor instead (§8), but note the trick.

**Do not modify `tools/readme-media/`.** Copy what you need into `tools/showreel/` and say so in your report.

**This app.** Read these files:
- `README.md` (the Design system, Motion system and Features sections);
- `docs/prompts/ui-revamp.md` (the brand and motion brief; see the caution about it in §2);
- `frontend/src/styles.css` (tokens) and `frontend/src/motion.css`;
- `frontend/src/app/motion/{tokens,wipe,spin,assembly-timeline,intro,route-transition,progress-store}.ts`;
- components: `hero-carousel`, `hero-stage`, `hero-info`, `assembly-demo` (+ `showcase.config.ts`, `assembly-plate`), `cook-mode`, `spin-overlay`, `recipe-tile`, `stamp`, `garnish`;
- pages: `home`, `all-recipes`, `view-recipe`, `saved-recipes`;
- `services/{auth,apiservice,recipe-progress}.ts` and `models/{recipe-model,ingredient,recipe-meta}.ts`.

---

## 2. Facts about the app the reel depends on (verified 2026-11-25; re-check them)

**Stack and run.**
- Angular 20 frontend: `cd frontend && npm start` serves `ng serve` on `http://localhost:4200`. The dev environment's `apiUrl` is `http://localhost:3000`, which is a cross-origin call from the page.
- Express + Mongoose API on `:3000`: `cd backend && npm start`.
- `backend/.env` exists, with an Atlas-style `mongodb+srv` `MONGO_DB`, `JWT_KEY`, `PORT=3000` and `FRONTEND_URL=http://localhost:4200`. **Never print its values, and never use the API for writes from this tool.** It is a shared remote database.

**Data at the time of writing.**
- `GET /api/allRecipes` returns `{ message, response: Recipe[] }` with **30 recipes** across 17 cuisines (Italian 6, Pakistani 6, Mexican 2, Asian 2, Indian 2, then one each of the rest).
- **Every `image` is a remote `https://cdn.dummyjson.com/recipe-images/<n>.webp`.** Credit DummyJSON in the README and check its terms before publishing the reel anywhere.
- Records also carry `rating`, `reviewCount`, `tags` and `userId`, which **the UI never shows. Neither may the reel.**

**What the data means on screen.**
- **Hero:** the first five recipes with photos, in API order: Italian Tiramisu, Chicken Biryani, Mango Salsa Chicken, Classic Margherita Pizza, Chicken Alfredo Pasta.
- **Hero field colours** (`activeIndex % 4`): tomato `#C8281C`, paprika `#B4410E`, beet `#9B1B3C`, basil `#2F5A2E`.
- **Assembly Demo:** `pickShowcase` picks **Korean Bibimbap, Caprese Salad, Aloo Keema**.
- **Italian filter:** gives 6 recipes in this order: Tiramisu, Margherita, Alfredo, Caprese, Shrimp Scampi Pasta, Tomato Basil Bruschetta.
- **Classic Margherita Pizza** is `_id 6985c5ce51ab347a0ec252f0`: 6 ingredients, 6 steps, prep 20, cook 15, serves 4, 300 kcal, Easy.

**Behaviour the shots rely on** (all real, all in code):
- **Hero (`hero-carousel`):**
  - A "lazy-Susan" platter of up to 5 dishes, driven by one `turns` signal.
  - Each change is a single 970 ms gesture: the field wipes with the measured `--ease-wipe` curve and a **6 px solid yolk edge**, the ring turns, and the ghost word (the cuisine), garnish stickers and blurred props arrive at their own depths (word .40, platter .30, dish .15, garnish .55, props .75).
  - The info block rewrites with an odometer `01/05`.
  - Interaction: drag or swipe to spin the platter (1:1, snap on release, flick adds a step), Prev/Next/dots/pause, and a "VIEW →" cursor tag over the dish on fine pointers.
  - Autoplay every 5.2 s. It pauses on hover, focus, any user action (for 6 s), a hidden tab, or less than 30 % visibility.
  - A once-per-session opening sequence (sessionStorage `cwm.intro.v1`).
- **Assembly Demo (`assembly-demo`)**, kicker "The demo", heading **"Watch it come together."**:
  - Each item runs an 8,000 ms timeline: Set 0–600, Gather 600–2,600, Converge 2,600–4,000, Build 4,000–5,200, Orbit 5,200–7,000, Present 7,000–8,000.
  - Then a 1,400 ms hold (Explore: "DRAG TO TURN THE PLATE"), then a 970 ms hand-off wipe to the next item.
  - **Tickets are the recipe's real ingredients**, at most 8 plus "+N more" (4 in compact). They converge, an 8-square burst marks the join, and the dish photo **irises open** with a 6 px yolk ring.
  - A **simulated** camera then orbits: Top-down → Three-quarter (58°, −28°) → Low (66°, −62°) → Top-down.
  - The driver is **scroll-scrubbed** when `(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)`; the section is a sticky stage in a `3 × 160svh` track. Otherwise it uses a **player** (plays once when ≥50 % visible).
  - **Each recipe has one photo; the angles are a simulated camera.** No caption may imply other photographs.
- **Index (`all-recipes`):**
  - A mask-rise title, an odometer count, and **Surprise me**.
  - Search with a `/` shortcut and `<mark>` highlighting.
  - Cuisine and meal-type chips (yolk fill from the left, `aria-pressed`) with live filtering.
  - Tiles: a clip-path reveal and a yolk **"COOK THIS →"** band on hover/focus. Clicking a tile is a **shared-element morph** (View Transition) into the detail page.
- **Surprise me (`spin-overlay`):**
  - A `<dialog>` wheel of up to 8 recipes **from the currently visible set**.
  - The winner is picked first (`Math.random`), then the wheel spins 2.8 s with `cubic-bezier(.12,.8,.2,1)`; each dish pulses as it passes the yolk marker, at times from `crossings()` in `motion/spin.ts`.
  - The result card reads "TONIGHT, COOK" with the name, tags, **Cook this**, Spin again and Close.
- **Detail (`view-recipe`):**
  - Facts count up (prep, cook, serves, kcal); a dashed yolk platter ring sits behind the sticky photo.
  - Ingredient check-offs persist per recipe; method steps have a progress rail.
  - **Save** (signed in only) shows a filled bookmark, "Saved", and a **SAVED stamp** with an 8-square burst. Download PDF, Share/Copy link, and **Start cooking** (also `?cook=1`).
- **Cook Mode (`cook-mode`):**
  - A full-screen `<dialog>` showing `STEP 01 / 06` with progress squares.
  - Each step is on a field colour in rotation (tomato, paprika, beet, basil), with cream big type and an oversized Dela Gothic numeral.
  - Next/Previous is a **640 ms direction-aware wipe with the yolk edge**.
  - An Ingredients drawer with the same check-offs.
  - It resumes from `localStorage` key `cwm.cook.v1.<recipeId>` = `{"t": <ms epoch>, "v": {"step": <0-based>, "total": <n>, "name": "…"}}`, entries over 14 days old are pruned, and it needs `total` to match.
  - Finish shows **"NICE ONE."** with a **DONE** stamp, plus "Save to collection" and "Back to recipe".
- **Saved (`saved-recipes`):** "Your Collections" with an odometer "N saved" and a grid of photo tiles with hard yolk offsets. Removing a recipe closes the grid with FLIP, and an Undo toast appears.
- **Admin dashboard:** count-up stat blocks (users, recipes, downloads, pending requests) and a top-downloads table. It has no food imagery and needs an admin session, so it is **off by default** in this reel (see §6.4).

**Do not show or imply anything the app does not have:**
- cook-mode timers or any timer sound;
- a servings scaler;
- a "continue cooking" band;
- ratings, reviews, likes, authors or prices;
- multiple photos per dish, video, or nutrition beyond kcal;
- AI, meal plans or grocery lists;
- a native or app-store app. The vertical cut shows the **responsive web app**.

`docs/prompts/ui-revamp.md` lists some of these as P2. **They were not built.** Trust the code, not the brief.

**Existing media:** `docs/readme/*.webp|png` (the hero, browse, recipe, cook, surprise and assembly clips, screens and a brand sheet) come from `tools/readme-media/`. The README already labels the signed-in screens as sample data. The reel should complement those clips, not re-cut them, and must not change them.

---

## 3. Deliverables and file layout

```
tools/showreel/                     # new; mirrors specshield-qa/showreel/
  package.json                      # playwright-core 1.64.1, ffmpeg-static 5.3.0 (same pins as tools/readme-media)
  .gitignore                        # node_modules/  out/
  timeline.mjs                      # THE edit decision list: beat times, segments, cuts, click/event times, caption cues
                                    # imported by shots, the compositor page and the score; one source of truth
  fixtures.mjs                      # records GET fixtures from the running API + caches photos (read-only)
  fixtures/*.json                   # recipes, testimonies (empty), saved list, save responses; no PII, no tokens
  lib/vclock.js                     # copied from tools/readme-media/lib/vclock.js, gaps closed (see §5.1)
  lib/score.js                      # the score (see §9)
  lib/cover.js                      # cover() and cubic-bezier solver, ported from frontend/src/app/motion/{tokens,spin}.ts
  shots.mjs                         # 16:9 shot list
  shots-vertical.mjs                # 9:16 shot list (same beat times)
  capture.mjs                       # --aspect 16x9|9x16, --sheet, --workers
  reel.html                         # WebGL2 compositor; ?aspect=16x9|9x16
  render.mjs                        # --aspect, --beats, --at, --range, --audio, --encode, --crf
docs/reel/
  cook-with-me-reel.mp4             # master 16:9
  cook-with-me-reel-web.mp4         # README cut (≤ 9.4 MB)
  cook-with-me-reel-vertical.mp4    # 9:16 social cut
  cook-with-me-reel-thumb.jpg       # 1920×1080 poster
  cook-with-me-reel-vertical-cover.jpg  # 1080×1920 cover
```

`npm` scripts: `fixtures`, `capture`, `render`, `beats`, `audio`, each taking `-- --aspect 9x16` where it applies.

Update `README.md`:
- Add a "▶ Watch the 45-second reel" link near the top, pointing at the web cut, with the thumbnail.
- In the existing **README media** section, add a short **Reel** paragraph covering:
  - the files;
  - how to re-render;
  - the honesty line: *"Filmed from the running app. API responses are served from fixtures recorded from the real API, and save responses are mocked. Recipe photos: DummyJSON."*

---

## 4. Data: real recipes, with no writes

1. **Record once** (`npm run fixtures`, with the API running).
   - **GET only:** `/api/allRecipes`, `/api/viewRecipe/:id` for every recipe the reel opens, and `/api/relatedRecipe?cuisine=Italian`.
   - Write each to `fixtures/` as returned.
   - Download every recipe `image` once into `out/cache/images/` (gitignored).
   - Do **not** record `getAllUsers`, `getTestimony` or any endpoint that returns people. Serve `getApprovedTestimony` as `{ "approved": [] }` (the reel never films that section).
2. **Capture serves everything locally.**
   - In each shot's browser context, `context.route('http://localhost:3000/**', …)` fulfils from fixtures, and `context.route('https://cdn.dummyjson.com/**', …)` fulfils from the image cache. A cache miss is a hard error.
   - The page is on `:4200` and the API is on `:3000`, so add `access-control-allow-origin: http://localhost:4200` to every fulfilled API response. If an `OPTIONS` preflight reaches your handler, answer it with `204` plus `access-control-allow-headers: authorization, content-type` and `access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`. Prove in a smoke run that an authorised `POST` succeeds.
   - Keep SpecShield's stray-host guard: fail the shot if the page reaches any host except `localhost:4200`. The API and image routes count as local, but only because they are fulfilled, never forwarded.
   - Support `DATA=live`, which lets **GETs** pass to `:3000` for a look at current data. Writes are always mocked. **Any non-GET request without an explicit mock throws.**
3. **Signed-in shots.** `AuthService` only decodes `exp` from the token in `sessionStorage`; it never verifies the signature.
   - In `addInitScript`, set `sessionStorage.token` to an unsigned JWT whose payload is `{"exp": 4102444800}`.
   - Set `sessionStorage.userDetails` to `{"username":"Demo Cook","email":"demo@example.com","role":"User"}`.
   - Mock `POST /api/savedRecipe/:id` with `201 {"message":"Added to collection","newRecipe":{…}}`.
   - Mock `GET /api/getSavedRecipes` with an array of `{_id, recipeId, name, image, userId}` built from real recipes. Put Margherita last, since it was just saved.
   - Never register or log in against the real API.
4. **Intro gating.** The opening sequence plays once per session. Leave `cwm.intro.v1` unset in the hero shots (H, E) so the intro plays. Set it to `'1'` in every other shot, so a deep-linked page doesn't replay the header intro.

---

## 5. Capture

### 5.1 The virtual clock: start from this repo's, then close its gaps

Start from **`tools/readme-media/lib/vclock.js`** (copy it), not SpecShield's. It already handles:
- timers, rAF, `performance.now`, `Date` (epoch 2026-11-25 18:30 UTC) and `Event.timeStamp`;
- **skipping scroll-driven animations**: the header's scroll-progress bar and the detail page's rotating ring use `animation-timeline: scroll()` and must follow the scripted scroll;
- pinning View Transition animations;
- calling `finish()` when an animation reaches its end, and `cancel()` for CSS transitions;
- a real-time `settleImages()` on every step.

It pins every *other* animation to `now − firstSeen`. Check these four cases and fix whichever fail:

1. **App-scrubbed animations.** `AssemblyTimeline` keeps paused WAAPI animations and sets their `currentTime` from scroll (`seek(ms)`). If the clock re-pins them, the scrub is overwritten.
   - **Partly fixed already (commit `614f5e8`).** The repo clock now skips any animation that is paused when it wasn't the clock that paused it. That covers the scroll driver, where the page pauses both the clock animation and the tracks.
   - **Still uncovered:** the page setting `currentTime` on an animation that is *running*. The clock would overwrite it on the next step.
   - **Test it properly:** scroll to a fixed position, hold the scroll still for 2 s of virtual time, and confirm the frame doesn't change.
   - **If more is needed:** before page scripts run, wrap `Animation.prototype.pause`, `play` and the `currentTime` setter so calls coming *from the page* mark the animation as app-controlled (sketch below). When the app calls `play()`, resume driving that animation from its current time.
2. **`finished` promises and end events.**
   - `wipe()`/`sweep()` callers await `animation.finished`. For example, the hero clears its leaving colour panel and Cook Mode drops the old step only after `finished` resolves.
   - Angular `animate.leave` and View Transitions need their animations to *end*.
   - A paused animation never finishes. The repo's clock already calls `finish()` at the end. It *cancels* CSS transitions instead, which fires `transitioncancel` rather than `transitionend`. If any leave or enter animation hangs (an element that should go stays in the DOM), call `finish()` for transitions as well.
3. **`playbackRate`.** The marquee changes it with scroll velocity. Advance each driven animation by `dt × playbackRate`, not by `now − born`.
4. **Randomness.** The Surprise wheel calls `Math.random()` twice: winner `= pool[floor(r × n)]`, turns `= 3 + floor(r × 2)`. Replace `Math.random` with a seeded PRNG plus a scripted queue.
   - Just before the Surprise click, push `[0.25, 0.6]`. That gives index 1 of the 6 Italian recipes (Classic Margherita Pizza) and 4 turns.
   - Assert the landed winner in the shot.

A sketch of fixes 1–3, to be verified rather than trusted:

```js
const P = Animation.prototype, ct = Object.getOwnPropertyDescriptor(P, "currentTime");
const appPaused = new WeakSet(), local = new WeakMap(); let internal = false;
const _pause = P.pause, _play = P.play;
P.pause = function () { if (!internal) appPaused.add(this); return _pause.call(this); };
P.play  = function () { const r = _play.call(this); if (!internal) { appPaused.delete(this); local.set(this, ct.get.call(this) ?? 0); } return r; };
Object.defineProperty(P, "currentTime", { configurable: true, get: ct.get,
  set(v) { if (!internal && !appPaused.has(this)) local.set(this, v); ct.set.call(this, v); } });
function pinAnimations(dt) {
  internal = true;
  for (const a of document.getAnimations()) {
    if (a.timeline && !(a.timeline instanceof DocumentTimeline)) continue;   // scroll-driven: leave alone
    if (appPaused.has(a) || a.playState === "finished") continue;
    const t = (local.has(a) ? local.get(a) : 0) + dt * (a.playbackRate ?? 1);
    const end = a.effect?.getComputedTiming().endTime;
    if (Number.isFinite(end) && t >= end) { a.finish(); local.delete(a); continue; }
    local.set(a, t); if (a.playState !== "paused") _pause.call(a); ct.set.call(a, t);
  }
  internal = false;
}
```

Keep the repo clock's epoch, and keep any `cwm.cook.v1` `t` you seed within 14 days of it. The step must also support SpecShield's 180 fps subframes, whereas the README tool steps at 20 fps. Keep `settleImages()`.

**Prove the clock before filming the real shots.** This is an internal gate, not a stopping point. Run a smoke script that films 3 s of each case and prints a `--sheet`, then view the sheets yourself. Fix and re-run until every case passes. If a case still fails after a real attempt, use its fallback (listed under the cases) and continue.
- (a) a hero Next: the old colour panel is gone afterwards;
- (b) the Assembly Demo scrubbed to 4,600 ms: the photo is mid-iris, not the plate fallback;
- (c) a Cook Mode Next: only one step is left in the DOM afterwards;
- (d) the Surprise wheel lands on Margherita with the marker aligned;
- (e) a tile → detail morph completes and the view-transition pseudo-elements are gone.

For (e), `docs/readme/recipe.webp` already films this morph under the repo's clock, so it probably works. If it is unreliable at 180 fps subframes, film S and D as separate shots and use the plate iris (§7.2) for that cut instead.

Fallbacks for the other cases:
- (a), (c): if a leaving layer won't clear, call `finish()` on CSS transitions too (see fix 2).
- (b): if the iris still shows the plate, pre-decode the photo in `prepare` and re-take.
- (d): if the seeded `Math.random` can't steer the wheel, film takes until one lands on an Italian dish. Use that dish for S → D → C, and change the dish names in the timeline to match.

**Capture fallback if virtual time can't drive a case at 180 fps:** capture at 60 fps (one still per frame) and drop the motion-blur averaging for that shot. A clean shot without blur beats a broken one with it.

**Image and font readiness is real time, not virtual.**
- The intro waits up to 600 ms for fonts and the first dish, and the Assembly iris waits up to 600 ms for `img.decode()`. Under virtual time those waits can expire before the images arrive.
- In each `prepare`, poll in **real time**, without stepping virtual time, until `document.fonts.status === 'loaded'` and every on-screen `img` is `complete` with `naturalWidth > 0`.
- For the Assembly shot, also decode the three showcase photos.
- Treat a plate fallback on any frame as a failed take.

### 5.2 Browser and viewport
- **Browser:** the same flags as SpecShield (`--force-color-profile=srgb --hide-scrollbars`, plus the GPU flags), with `reducedMotion: 'no-preference'`. Use `channel: 'chrome'` (system Chrome worked headless here) or an installed Playwright Chromium, and pin whichever you use.
- **16:9:** viewport **1600 × 900 at DSF 1.5**, so stills are 2400 × 1350.
  - At 1920 wide, the 1440 px content wrap leaves dead margins; at 1600 the UI reads about 20 % larger in the frame.
  - Zoom headroom stays 1.25, the same as SpecShield. Never zoom past it.
  - This is still ≥1024 with a fine pointer, so the Assembly Demo uses its **scroll driver**.
- **9:16:** viewport **432 × 768 at DSF 3**, so stills are 1296 × 2304, with `isMobile: true, hasTouch: true`.
  - This is the app's compact composition: a stacked hero, the Assembly **player** driver with ≤4 tickets, and Cook Mode built for phones.
  - Zoom headroom is 1.2.
  - Hover-only features (the cursor tag, the tile band) correctly don't appear.
- **Subframes:** 16:9 runs `SUB_FPS = 180`, three subframes per 60 fps frame. 9:16 runs `SUB_FPS = 90`, three per 30 fps frame. Segment offsets must be multiples of 1/SUB_FPS.
- **Disk:** expect roughly 3 GB of 16:9 JPEGs and 1.5–2 GB of 9:16 under `tools/showreel/out/` (gitignored).

### 5.3 Shot API additions
Keep SpecShield's shot fields (`path`, `duration`, `css`, `prepare`, `cursor`, `clicks`, `events`, `scroll`, `anchors`) and add:
- **`drags: [{ at, from, to, dur }]`:** mouse down at `at`, eased moves every subframe, up at `at + dur`. This is for the hero platter. In 9:16, dispatch it as touch (`Input.dispatchTouchEvent`) if mouse pointer events don't drive the swipe.
  - `dragSteps()` adds an extra step when the release speed is over 0.5 px/ms. Ease the drag out so it releases slowly, or the platter will jump two dishes.
- **`init`:** per-shot storage seeding (session, intro flag, Cook Mode position) applied in `addInitScript`.
- **`rand`:** `[{ at, values }]` pushes onto the `Math.random` queue.
- **Click and event times are imported from `timeline.mjs`.** Never type the same number twice.

---

## 6. The edit: 45.0 s at 120 BPM

The grid is 120 BPM, so a bar is 2.0 s and a beat 0.5 s. Downbeats fall on even seconds.

**Transition timing rule:** the measured wipe curve is slow, then rushes, then lands long. Its rush (coverage ≈ 0.55) falls at about 58 % of the run, so **start each wipe so its rush hits the beat**:
- 970 ms wipe: start = beat − 0.57 s
- 640 ms wipe: start = beat − 0.37 s
- 900 ms iris: start = beat − 0.52 s

Clicks land on beats. A hit lands on every cut. Segments overlap their cuts, so both sides are already moving.

### 6.1 Timeline (16:9 master; 9:16 uses the same times, see §6.3)

| Reel time | Segment / cut | What happens on screen | Camera (zoom 1 = whole viewport) | Sound |
|---|---|---|---|---|
| 0.00–2.40 | **TITLE** (drawn) | Flat **broth** field. 0.00–0.90: a cream plate with a 3 px dashed yolk ring slides in from the right with weight (`--ease-arrive`). 0.35–1.25: the **Tiramisu photo irises open** inside it (cover curve, 6 px yolk ring leading). On the left, "WHAT'S FOR" mask-rises at 0.15 (words staggered 70 ms). A yolk block wipes in from the left at 0.55–0.80, then "DINNER?" rises inside it in broth. | locked, 1.00 → 1.03 | soft hit at 0.0, plate clink at the iris, a knock per word |
| 1.43–2.40 | **T1 field wipe**, forward, 970 ms (rush 2.00) | Broth title → tomato hero, with the yolk edge | | whoosh shaped by the curve; **downbeat hit at 2.00, the groove starts** |
| 1.43–9.90 | **H** hero (signed out, first visit) | The opening sequence plays: layers slide in from the right at their depth factors, the headline mask-rises, the info block rises. Tiramisu is active (ghost word ITALIAN). | 1.00 full poster; 3.0–4.5 drift to 1.08 toward the platter | |
| 4.30–4.90 | | The cursor enters bottom-right and rests on the dish (the app's "VIEW →" tag follows it). Hover pauses autoplay; confirm no unscripted advance. | | |
| 4.93–5.43 | | **Drag to spin.** Press on the platter and drag left about 0.42 of the hero width, then release at 5.43 → snap one forward. The paprika field wipes in (rush 6.00): ghost word PAKISTANI, garnish set B, info rewrites to CHICKEN BIRYANI, odometer 01 → 02. | follow the platter, 1.10 | a wooden knock per slot crossed, whoosh |
| 7.43 | | Click **Next** → beet field (rush 8.00), MANGO SALSA CHICKEN, MEXICAN | ease to frame platter + info | tick, knock |
| 8.60–9.90 | | The cursor leaves; push into the active dish | anchor `dish` → 1.25 | riser |
| 9.00–9.90 | **T2 plate iris** (rush 9.50) | B opens inside a circle growing from the active dish's centre, starting at the dish's radius. A 6 px yolk ring leads, with a dashed yolk ring outside it. B settles from −18° to 0° and from 1.12 to 1.0 | | plate clink + hit at 9.50 |
| 9.00–18.00 | **A** Assembly Demo (scroll-scrubbed; demo ms = (reel − 9.00) × 1000, constant 1×) | Paprika field, ghost KOREAN, an empty plate (Set). Real Bibimbap tickets fly in on arcs (Gather 9.6–11.6) and spiral in (Converge 11.6–13.0). **The join burst lands at 13.00.** The photo irises open and the plate gains thickness (13.0–14.2). Orbit 14.2–16.0: THREE-QUARTER around 14.8, LOW around 15.4, back to TOP-DOWN. Present 16.0–17.0: KOREAN BIBIMBAP, tags, Start cooking. Hold with the "DRAG TO TURN THE PLATE" hint. | 1.00; slow push to 1.08 on the plate during the orbit; ease left to frame name + tickets at Present | a paper flick per ticket (panned by x), whoosh on converge, **hit + 8 ticks at 13.00**, clink on the iris, a pad swell under the orbit |
| 17.40–18.50 | **T3 ticket deal** (full cover at 18.00) | Oversized ingredient tickets (Bibimbap's real ingredients) arc in from every edge and cover the frame by the downbeat. The scene swaps underneath, then they fly out the other side. | | flicks, **hit at 18.00** (the full kit returns) |
| 18.00–22.27 | **I** index (signed in) | ALL RECIPES masks in, the kicker rule draws, the odometer shows 30. Click **ITALIAN** at 19.00: the chip fills yolk, the odometer rolls 30 → 06, the grid FLIPs. Scroll 19.5–20.4 (eased) to the six Italian tiles revealing. Hover tile 02, Margherita, at 20.80: the yolk COOK THIS band slides up. | 1.15 on chips + odometer → follow the scroll at 1.0 → push into tile 02 at 1.20 | tick, odometer clicks, small whoosh |
| 21.63–22.27 | **T4 field wipe**, forward, 640 ms (rush 22.00) | | | whoosh |
| 21.63–35.27 | **S → D → C**: one continuous shot (Italian preselected in `prepare`; runs through T5) | | | |
| 23.10 | S | Click **SURPRISE ME**; the dialog opens. 23.15–25.95: the wheel of 6 Italian dishes spins and each dish pulses at the marker. It **lands on Margherita at about 25.95**. 26.00: the result card (photo, TONIGHT, COOK / CLASSIC MARGHERITA PIZZA, tags). | 1.0 → 1.22 on the wheel → ease to the result card | **ratchet ticks at each `crossings()` time**, a chord + clink at 26.00 |
| 27.00 | S → D | Click **COOK THIS** → the app's shared-element morph (the photo flies into the detail page) | follow the photo | whoosh |
| 27.0–29.55 | D detail | The title mask-rises; facts count up (20 MIN, 15 MIN, 4, 300 KCAL, staggered 80 ms); the dashed yolk ring sits behind the pizza. **Click SAVE at 28.50**: filled bookmark, "Saved", the SAVED stamp slams over the 8-square burst. Click **START COOKING** at 29.50. | 1.10 on title + photo → buttons | count-up ticks, **stamp thump at 28.50** |
| 29.55–35.27 | C Cook Mode | STEP 01/06 on tomato: "Preheat the oven to 475°F (245°C)." **Next at 30.63** → wipe to paprika 02 (rush 31.00). **Next at 31.63** → beet 03 (rush 32.00). INGREDIENTS at 32.50, then check "Fresh mozzarella cheese" at 33.00 and "Fresh basil leaves" at 33.50 (ticks draw, strike line) | push onto the numeral 1.0 → 1.15; frame the drawer | a low sizzle bed under Cook Mode, whoosh per wipe, a tick per check |
| 34.63–35.27 | **T5 field wipe**, forward, 640 ms (rush 35.00) | The same language as the app's own step wipe: a jump ahead | | whoosh |
| 34.63–38.40 | **C2** Cook Mode resumed at STEP 06/06 (seeded `cwm.cook.v1.<id>` = step 5 of 6) | Click **FINISH** at 35.63 → wipe to the broth/yolk finish screen: **"NICE ONE."** with the DONE stamp (about 36.2), "Classic Margherita Pizza is ready. Enjoy it." | push on NICE ONE, 1.0 → 1.12 | **chord + stamp thump at 36.00** |
| 37.43–38.40 | **T6 platter spin** (rush 38.00) | A rides off the ring to the left as a shrinking round plate; K rides in from the right onto a broth platter | | knock, whoosh |
| 37.43–40.40 | **K** Your Collections (signed in) | YOUR COLLECTIONS, the odometer rolls to N saved, saved photo tiles reveal with hard yolk offsets (Margherita last) | 1.0 → 1.08 | groove |
| 39.43–40.40 | **T7 field wipe**, *back* (left → right), 970 ms (rush 40.00) | Mirrors T1 | | whoosh, hit at 40.00 |
| 39.43–45.00 | **E** end card: the real hero (intro plays; header, kicker, lede, CTAs, info block and controls hidden by injected CSS; the real headline kept) | The platter, dishes, garnish and the real **"GOOD FOOD. / YOUR WAY."** headline (the app's own mask-rise). Drawn, aligned to the `#hero-title` anchor: the wordmark **COOK [WITH ME]** above it at 40.30, then below it the kicker "DISCOVER · SAVE · COOK" at 41.50 and `github.com/AaronStark1/cook-with-me` at 42.00. At 42.43, click **Previous** via JS: a back wipe from tomato to tomato, so only the yolk edge sweeps behind the lockup and the platter turns (rush 43.00). | 1.00 → 1.04 | drums drop at 40, keys + pad resolve, **final hit at 44.00** |
| 44.50–45.00 | broth | | | the audio fades to silence by 45.00 (loops clean) |

### 6.2 Captions
- **9:16:** captions are on, because social video plays muted.
- **16:9:** off, except the title and the end card. The UI carries the story there, as in SpecShield.

Cues (≤ 4 words each, all true):
- "SPIN THE PLATTER" (4.5–7.4)
- "FILTER BY CUISINE" (18.6–21.4)
- "CAN'T DECIDE? SPIN." (22.6–25.9)
- "SAVE IT. COOK IT." (28.3–30.4)
- "STEP-BY-STEP COOK MODE" (30.6–34.4)

No caption over the Assembly Demo; its own heading says it.

### 6.3 The 9:16 cut
**Same `timeline.mjs` and same WAV.** Only the framing differs: different shots, cameras and overlay layout.
- **Shots:** re-film every shot at the phone viewport with `shots-vertical.mjs`.
- **Assembly Demo:** in 9:16 it is the **player** driver, and it plays only once per page load.
  - In `prepare`, scroll near the demo to trigger its `@defer`, wait for `.asm__stage`, then park it below 50 % visibility.
  - Scroll it to ≥50 % visible at exactly reel 9.00 so `play()` starts on the same beat. At 1× its phases land on the same times as the 16:9 scroll-scrub, which is why that scrub runs at a constant 1×.
- **Layout:**
  - Title: hook text in the top third, the plate centred, about 820 px across.
  - End card: wordmark + headline at the top, platter footage below.
  - Captions: Archivo 800 at 40 px.
- **Safe zones:** keep all type and key action inside x 64–1016 and y 220–1540. Platform UI covers the top bar, the bottom 380 px and a right-hand rail.
- **Touch indicator:** no arrow cursor. Use a 36 px cream square with a 3 px broth keyline. It presses to 0.85 scale and throws the same 8-square burst on tap. A drag shows the square travelling.

### 6.4 Optional beat (off by default)
**Admin dashboard, 2 s**, as an alternate to K: stat blocks reveal and count up. Only use it with an admin session and fixtures that keep the real *counts* but replace every user document with `{_id, role}` stubs. No names or emails, ever.

---

## 7. Transition vocabulary (compositor shader modes)
Every transition comes from the app's own motion language. Port `cover()` from `frontend/src/app/motion/tokens.ts` and the cubic-bezier solver from `motion/spin.ts` into `lib/cover.js`. Evaluate eased values in JS per camera sample and pass them as uniforms, as SpecShield does with `uP`.

- **§7.1 Field wipe** (T1, T4, T5, T7): the hero, route and Cook Mode wipe, re-rendered over whole frames.
  - Run `u` from 0 to 1 over D (970 or 640 ms); `c = cover(u)`.
  - Forward: A stays visible for `x < W(1 − c)`. Back: A stays visible for `x > W·c`.
  - A drifts against travel, sampled at `px + (dir·0.14·W·c, 0)`.
  - B arrives with parallax factor 0.15: `k = cubicBezier(0.5,1,0.89,1)` over `u ∈ [0.5, 0.92]`, B sampled at `px − (dir·0.15·W·(1 − k), 0)`. Where that sample leaves the frame, fill with B's flat field colour, never by clamping to the edge.
  - **A 6 px solid yolk bar rides the boundary**, scaled by the output scale, on the incoming side.
  - No darkening, no blur, no glow.
- **§7.2 Plate iris** (T2, and the fallback for S → D): the Assembly iris and the platter.
  - The origin is an anchor centre (the active dish, or the result photo); `r = mix(r0, reach + 12, cover(u))` over 900 ms.
  - Inside the circle: B, rotated `−18°·(1 − c)` and scaled `1.12 → 1.0` about the origin.
  - The ring: a 6 px solid yolk annulus at r, plus a 3 px **dashed** yolk ring 14 px outside it (dashes about 18/12 px, turning with the rotation).
  - Outside: A, scaled 1 → 1.06 about the origin.
  - Circles are allowed here because this is the platter/plate motif.
- **§7.3 Ticket deal** (T3): the Assembly tickets, oversized.
  - 12–16 tickets drawn on the overlay canvas above both sides, using the app's ticket style: hard-edged cream or yolk blocks, a Dela Gothic uppercase name, an Archivo quantity label, broth text, −6° to +6° rotation, and a hard `4px 4px 0` broth offset shadow.
  - The text is A's recipe's real ingredients, split with the logic of `models/ingredient.ts` `splitIngredient`.
  - Entry points are spread around all four edges and computed from the index (no randomness). Paths are arcs.
  - In: `--ease-arrive`, staggered 40 ms. Swap A → B under **verified 100 % coverage** at the downbeat (render the ticket alpha at the swap frame and assert there are no holes). Out: `--ease-glide`, staggered 30 ms, toward the opposite edges.
- **§7.4 Platter spin** (T6): the hero's lazy-Susan maths applied to whole frames.
  - A and B each ride a ring around a pivot below the frame `(W/2, 1.9·H)`. A goes 0 → −24°, B goes +24° → 0, with scale following the hero's law (`1 → 0.56` while leaving, `0.56 → 1` while arriving).
  - Each frame is masked by a circle that covers the frame at rest and reads as a round plate when shrunk, with a 12 px cream rim like the hero dishes.
  - Behind them is a flat broth platter with its concentric rings in a flat tint (the precomputed equivalent of `color-mix(in srgb, var(--ink) 12%, var(--broth))`).
  - Ease `cubic-bezier(0.65, 0.02, 0.2, 1)` over 970 ms.
- **In-app transitions, filmed rather than faked:** the hero wipe, the Assembly join/iris/hand-off, the tile → detail morph, the Cook Mode step wipes and the Surprise wheel. These are the best transitions in the reel; let them play at full length.

**Motion blur.** Keep SpecShield's 3 subframes × 4 camera samples (about a 240° shutter).
- Check the yolk edge at the rush in a `--range` sheet. If the stepped triple edge reads soft, narrow the shutter for transition frames (subframes at ±1/360 s).
- **Do not** add bloom, vignette, grain, glow or any gradient pass. SpecShield's bloom and vignette are exactly what this brand forbids.

---

## 8. Type, colour and drawn elements

- **Colour:** only the app's tokens.
  - paper/tomato `#C8281C`, ink/cream `#FFF3E0`, surface `#A51F15`, yolk `#FFC93C`, broth `#1C0F0A`, muted `#FFE6DA`, ink-soft `#5E4B43`;
  - the field colours paprika `#B4410E`, beet `#9B1B3C` and basil `#2F5A2E`;
  - tints only as precomputed flat mixes of these.
  - Pairings: cream on red, broth or any field colour; broth on yolk or cream. **Never yolk text on red.**
- **Type:** exactly two families, loaded from the app's own files. Abort the render if `document.fonts.check` fails; never render with a fallback face.
  - Dela Gothic One: `frontend/node_modules/@fontsource/dela-gothic-one/files/dela-gothic-one-latin-400-normal.woff2`, for display, uppercase, line-height about 0.92–0.98, numerals at −0.02em.
  - Archivo Variable: `…/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2`, used for kickers, labels, captions and the URL. Kicker style: 800 weight, 0.14em tracking, uppercase, with a 44 px × 3 px leading rule, matching `.kicker`.
- **Reveals:** words mask-rise (translateY 105 % → 0 inside a clip, `cubic-bezier(0.22, 0.8, 0.3, 1)`, staggered 70 ms) or wipe from the left. Never a plain fade-in of type, never letter-by-letter typing.
- **Shape language:** square corners, hard edges, flat colour, hard offset shadows (`N px N px 0`). Circles only for the plate and platter motif (title plate, plate iris, platter spin, play button).
  - **Forbidden:** gradients, glows, glass, `backdrop-filter`, rounded pills or cards, soft drop shadows, bloom, vignette, lens effects.
  - Grep `reel.html` for `createLinearGradient|createRadialGradient|shadowBlur|filter|roundRect` before you finish.
- **Cursor (16:9):** a classic arrow, cream fill, 2.5 px broth keyline, and a hard 3 px broth offset shadow.
  - It appears in 120 ms with `--ease-arrive` and no overshoot (the house motion is "not bouncy").
  - On press it moves (+2, +2) and the shadow collapses, like `.btn-cwm:active`, then throws **8 hard squares** (yolk, cream, broth) 24 px outward over 400 ms. This is the app's save-burst language, used instead of SpecShield's ripple ring.
- **Captions:** the app's toast look: a broth block with an 8 px yolk left edge, cream Archivo 800 uppercase with 0.14em tracking. 26 px in 16:9 and 40 px in 9:16, bottom-left. They slide in from the left over 420 ms with `--ease-arrive` and leave with a clip wipe.
- **Thumbnail and cover:**
  - 16:9: the end-card frame at about 43.6 s with a play glyph on the active dish: a cream disc, a 6 px yolk ring and a broth triangle.
  - 9:16: the title frame at about 1.3 s (hook + Tiramisu plate), with no play glyph.

---

## 9. The score (`lib/score.js`)

Use the same approach as SpecShield: an OfflineAudioContext at 48 kHz stereo, a fixed seed, a base64 16-bit WAV returned through `renderAudio()`, and **every event time imported from `timeline.mjs`**. Only the sound design is new: warm and kitchen-percussive.

- **Music:** 120 BPM, F major, **F – Dm – Gm – C**, one chord per bar. 22 bars, with the final hit at 44.0 and silence by 45.0.
  - Drums: a soft sine kick, rim/clave on 2 and 4, swung 16th shakers.
  - Bass: a round sine + triangle with a pluck envelope, root–fifth.
  - Keys: electric-piano FM stabs (sine carrier, ratio-1 modulator, decaying index) on the off-beats.
  - Plucks: marimba-like (sine + 4× partial, fast decay) for the browse and spin section.
  - Pad: filtered saws, only under the Assembly orbit and the end card.
- **Arrangement:**
  - bar 1: keys + clink, no drums;
  - 2–9.5 s: groove in;
  - 9.5–18 s: thinned to shaker, pad and plucks, building to the join;
  - 18–27 s: full kit + marimba arpeggio;
  - 27–37.4 s: half-time feel with the sizzle bed;
  - 37.4–40 s: groove;
  - 40–44 s: drums out, resolve to F, final hit.
- **Sound design, all synthesised and all placed on picture events:**
  - **Whoosh:** band-passed noise whose gain follows the *derivative* of `cover(u)`, so it swells exactly in the wipe's rush. The centre frequency follows `cover`, and the pan follows the edge direction.
  - **Plate clink:** inharmonic sine partials (≈ 1, 2.76, 5.40, 8.93 × 1.9 kHz, decays 0.6/0.3/0.15 s) on irises, dish landings and the wheel result.
  - **Wooden knock:** 180 + 420 Hz, a 40 ms decay plus a click, on platter slot crossings and Cook Mode presses.
  - **Paper flick:** 25 ms of high-passed noise, panned to the ticket's x, one per ticket.
  - **Stamp thump:** a sine drop at 90 Hz plus a low-passed slap, for SAVED and DONE.
  - **Odometer and count-up ticks:** one per digit change, computed from the real values (30 → 06; 0 → 20/15/4/300, capped at about 12 ticks per count).
  - **Wheel ratchet:** a tick at every `crossings(total, count)` time, with pitch easing down as the wheel slows.
  - **Sizzle bed:** band-passed noise at 3–6 kHz with sparse crackle, about −30 dB, during Cook Mode only.
  - **Join:** a hit + 8 ticks.
  - **Clicks:** a soft tick on every press in `meta.json`.
  - **No timer bell or kitchen-timer ring** (the app has no timers).
- **Mix:**
  - The music bus ducks under kicks (as SpecShield does) and dips 4 dB for 120 ms under each sound effect.
  - Use a small room reverb (about 0.8 s IR) instead of a hall.
  - Master: tanh soft-clip.
  - Level: normalise to **−14 LUFS integrated, true peak ≤ −1.0 dBTP after AAC**. SpecShield shipped −13.0 LUFS and −0.4 dBTP, which is too hot for social. Normalise in `score.js` to about −5 dBFS sample peak, then verify with `ffmpeg -af ebur128=peak=true` on each encoded file. If it misses, run a two-pass `loudnorm` (linear) on the WAV before muxing.

---

## 10. Render and encode (`render.mjs`)
Use SpecShield's structure: a tiny static server (`tools/showreel` plus the app's font files and `out/cache/images`, since the title plate and ticket deal draw fixture photos and ingredients), N pages, `renderFrame(k)` → JPEG at quality 97, `renderAudio()`, then ffmpeg. Keep the BT.601-full → BT.709-tv conversion and tags, and `-movflags +faststart`.

| Output | Spec | Encode | Budget |
|---|---|---|---|
| `cook-with-me-reel.mp4` | 1920×1080, 60 fps, 45.00 s | libx264 `-preset slow -crf 22 -profile:v high -level 4.2 -g 120`, yuv420p, AAC 192k 48 kHz | **≤ 45 MB** (GitHub warns at 50 MB). Raise CRF before cutting content. |
| `cook-with-me-reel-web.mp4` | 1280×720, 30 fps | two-pass ABR from frames: `fps=30,scale=1280:720:flags=lanczos`; video ≈ `(9.4 MiB×8/45) − 96 − 40` kb/s ≈ 1.6 Mb/s; AAC 96k | **≤ 9.4 MB** (README drag-and-drop limit 10 MB) |
| `cook-with-me-reel-vertical.mp4` | 1080×1920, 30 fps | libx264 `-crf 20 -maxrate 10M -bufsize 20M -profile:v high -level 4.2 -g 60`, AAC 192k | about 15–30 MB |
| `cook-with-me-reel-thumb.jpg` | 1920×1080 | from the 16:9 end card + play glyph | |
| `cook-with-me-reel-vertical-cover.jpg` | 1080×1920 | from the 9:16 title frame | |

Review modes (use them constantly):
- `--beats`: 90 frames, one every 0.5 s, on a contact sheet;
- `--at`;
- `--range a,b,step`;
- `--audio`;
- `--encode`.

`capture --sheet` gives one frame per 0.25 s per shot.

---

## 11. Acceptance checks (all must pass; report the numbers)
1. **Durations:** every MP4 is 45.00 s ± 1 frame, and video and audio are the same length (check with `ffmpeg -i`).
2. **Specs:** each output matches §10 exactly: resolution, fps, H.264 High, yuv420p, BT.709 tags, AAC 48 kHz stereo. Master ≤ 45 MB; web cut ≤ 9.4 MB.
3. **Determinism:** rendering the same 6 frames (1.9, 9.5, 13.0, 25.95, 36.2, 43.6) twice gives identical JPEGs. Re-capturing shot I gives identical `meta.json` anchors.
4. **Offline and read-only:** no capture contacted a host other than `localhost:4200`, with the API and image routes fulfilled locally. **No non-GET request reached `:3000`**; the route handler logs this and fails otherwise. `backend/.env` was never printed, and the fixtures contain no tokens, emails or user records.
5. **Real content only:** every recipe name, ingredient, step text, fact and photo on screen comes from the recorded fixtures. No ratings, reviews, timers, scaler, extra photos or other §2 non-features. Nothing says "angles", "photos" or "3D" about the Assembly orbit.
6. **Fonts:** Dela Gothic One and Archivo were confirmed loaded in every capture and in the compositor. There is no fallback face in any frame.
7. **House rules in the drawn layers:** no gradient, glow, bloom, vignette, blur filter, rounded rect or soft shadow in `reel.html` (by grep, and by sampling the overlay pixels to check they are token colours or exact alpha blends of them). Every circle is plate or platter motif.
8. **The frames that matter:** inspect and save single frames at each of these moments:
   - 2.00: T1 rush, yolk edge crisp;
   - 6.00: hero wipe mid, with the headline on flat colour either side;
   - 9.50: the iris, with ring and dashed ring;
   - 13.00: the join burst, a photo and not the plate fallback;
   - 15.40: the LOW angle;
   - 18.00: the deal at full coverage, no holes;
   - 25.95: the wheel landed on Margherita, marker aligned;
   - 28.60: the SAVED stamp;
   - 31.00: a Cook Mode wipe mid;
   - 36.20: NICE ONE + DONE;
   - 43.00: the end-card wipe behind the lockup.

   Do this for **both** aspects. In 9:16, nothing important may sit outside the safe zones.
9. **Sync:** every press in `meta.json` has its tick within ±1 frame. Every transition's whoosh peak lands within ±2 frames of its rush. The wheel ticks line up with the visible pulses.
10. **Loudness:** each file measures −14 ± 1 LUFS integrated and ≤ −1.0 dBTP true peak.
11. **Contact sheets:** the `--beats` sheet for each aspect has been viewed. There are no dead frames, no half-loaded pages, no unscripted hero autoplay advance, and no leftover leaving layers.
12. **Hygiene:** apart from `docs/prompts/`, `git status` shows only `tools/showreel/` (without `out/` or `node_modules/`), `docs/reel/` and the README note. `git diff --stat frontend backend` is empty. `tools/readme-media/` is untouched.

---

## 12. Order of work (one continuous run, no stops)
Do these in order, in a single run. Each step ends when its own checks pass, not when the user replies.

**Priority:** finish the 16:9 master and web cut completely, with checks and README note, before starting the vertical cut. A run that ends early should still leave a finished, verified 16:9 reel.

1. **Clock and data spike:** the vclock adaptation, the five smoke cases in §5.1, and fixtures with an authorised mocked POST. Fix until they pass, or take the §5.1 fallbacks.
2. **Fixtures:** `npm run fixtures`, the image cache, and the session and storage seeding.
3. **16:9 shots:** H, A, I, S+D+C (or S | D+C if the morph fails), C2, K, E. View each `--sheet` and re-take any shot with dead frames, half-loaded images or an unscripted hero advance.
4. **Compositor:** segments, cameras, the four transition modes and the overlays (title, cursor, captions, end card). View the `--beats` sheet and a `--range` sheet around every cut, and fix what's wrong.
5. **Score:** `npm run audio`. You can't listen, so verify with numbers instead:
   - render a quick low-res mux;
   - check sync with check 9 (events against `meta.json` and the cut times);
   - check loudness with check 10 (`ebur128`).
6. **Master and web encodes,** with checks 1–3 and 8–10 on 16:9. Update the README note now, so the 16:9 deliverable is complete.
7. **Vertical:** shots, layout, encode and cover, then every check on 9:16.
8. **Final checks and report:** checks 4–7, 11 and 12 across everything, then the §13 report.

## 13. Final report
Report:
- what shipped, with the paths and sizes of every output;
- the final timeline as built, with any deviations from §6 and why;
- whether the tile → detail morph was filmed in-app or replaced, and why;
- every fallback you took (which check failed, what you tried, and what you shipped instead), plus anything from §6 that was cut;
- the vclock changes and anything that still needed a workaround;
- the measured numbers: durations, bitrates, sizes, LUFS, true peak, render and capture times;
- what you could not verify;
- anything in the app you noticed that would make a better shot but would need an app change. Don't make that change.
