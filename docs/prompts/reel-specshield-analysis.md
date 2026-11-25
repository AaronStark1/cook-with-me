# How the SpecShield QA showreel was made

Source repo: `/Users/aaron.correya/Development/HacktoberFest/specshield-qa` (clean working tree when read).
Files read: everything in `showreel/` except `node_modules/` and `out/` (`showreel.html`, `render.mjs`, `capture.mjs`, `shots.mjs`, `record-showcase.mjs`, `readme-media.mjs`, `lib/score.js`, `lib/vclock.js`, `package.json`, `.gitignore`), the README's reel and "See it run" sections, and commits `c153407`, `b2cbc14` and `696c374`.
Media inspected with `showreel/node_modules/ffmpeg-static/ffmpeg`: frames at 1 fps, plus hand-picked frames at every transition and click. Scene detection found almost nothing because every cut is a soft, shader-driven transition, so I sampled at the cut times taken from the code instead.

---

## 1. The outputs

| File | Spec (measured) | Size |
|---|---|---|
| `docs/specshield-showreel.mp4` (master) | 1920×1080, 60 fps, H.264 High, yuv420p, BT.709 tagged (tv range); AAC-LC 48 kHz stereo, about 206 kb/s; 40.00 s; overall 8.73 Mb/s | 43.66 MB |
| `docs/specshield-showreel-web.mp4` (README cut) | 1280×720, 30 fps, H.264 High, two-pass ABR (about 1.81 Mb/s video); AAC about 97 kb/s; 40.00 s | 9.60 MB (target under GitHub's 10 MB upload limit) |
| `docs/specshield-showreel-thumb.jpg` | 1920×1080 JPEG: the end-card frame with a play button drawn in the shield's ring | 194 KB |
| `docs/readme/*.webp` (built by `readme-media.mjs` from the same footage) | Animated WebP: hero (960 wide, 15 fps, loops seamlessly), generate/matrix/code (1200 wide, 20 fps, with a caption bar), receipt (852), workflow/metrics (720) | 0.35–1.94 MB each |
| `docs/readme/title-{dark,light}.png` | Title lockup, one per GitHub theme | 110 / 62 KB |
| `public/media/*.mp4` (built by `record-showcase.mjs`) | Landing-page showcase loops, 1280×800, 30 fps, CRF 27, no audio, plus a `.jpg` poster | 160–360 KB each |

Audio, measured on the master with `ebur128`: **integrated −13.0 LUFS, LRA 4.8 LU, true peak −0.4 dBFS**. The source WAV (`out/specshield-showreel.wav`) is 40 s of 16-bit stereo at 48 kHz.

There is only a 16:9 version. No vertical or square cut exists.

## 2. History: a mock-up first, then the real app on film

- **v1 (`c153407`, 22 Oct):** a 15-second reel that **recreated the UI in HTML** (a "mock stage"). `window.seek(t)` restyled the DOM for second t. Each frame was three PNG subframes (t−5.5 ms, t, t+5.5 ms) blended by ffmpeg `tmix` into motion blur, and the result was muxed with an OfflineAudioContext WAV. File size was 5.8 MB.
- **v2 (`b2cbc14`, 18 Nov, the current reel):** replaced with **footage of the real app**, filmed frame by frame under a virtual clock, plus a WebGL compositor and a synthesised score. Runtime is 40 s, with a 720p web cut and a thumbnail. The README states the intent directly: *"The reel and the clips on this page are filmed from the app itself, not mocked up."*
- **`696c374` (19 Nov):** `readme-media.mjs` cuts the README's WebP clips and title cards from the same captured footage, so the reel and the README always match.

## 3. The pipeline

```
 running app (offline engine, empty DATA_DIR, no Sentry)
        │  capture.mjs + shots.mjs + lib/vclock.js     (Playwright, 180 fps subframes, virtual time)
        ▼
 out/shots/<id>/00000.jpg … + meta.json   (cursor per subframe, element rects every 3rd subframe)
        │  render.mjs → showreel.html (WebGL2)          (2,400 frames = 40 s × 60 fps)
        ▼
 out/frames/%05d.jpg   +   out/specshield-showreel.wav  (lib/score.js, OfflineAudioContext)
        │  ffmpeg (libx264 master CRF 22; web cut two-pass 720p30)
        ▼
 docs/specshield-showreel.mp4, docs/specshield-showreel-web.mp4
        │  readme-media.mjs (same shots) → docs/readme/*.webp, title-*.png
```

### 3.1 The virtual clock (`lib/vclock.js`)
The clock is injected with `context.addInitScript` before any page script runs. It replaces:
- `performance.now`, `Date` and `Date.now`, which run from a fixed epoch (`2026-11-18 10:00 UTC`) plus virtual ms;
- `Event.prototype.timeStamp`;
- `setTimeout`, `setInterval`, `clearTimeout`, `requestAnimationFrame`, `cancelAnimationFrame` and `requestIdleCallback`.

These are all held in maps, so they run only when the capture calls `__vt.step(ms)`. `advance(ms)` runs every due timer in time order, then one rAF batch at the new time.

- **CSS animations and transitions:** on each step, `document.getAnimations()` is walked. Each animation is paused, and its `currentTime` is set to (virtual now − the virtual time at which it was first seen). Finished CSS transitions are cancelled. As a result every frame is a pure function of the scripted inputs.
- **`<video>`:** videos are paused and seeked to virtual time, snapped to the middle of their own 24 fps frames. The clock waits for `seeked`, with a 500 ms real-time guard.

### 3.2 Capture (`capture.mjs` + `shots.mjs`)
- **Browser:** `playwright-core` 1.64.1, headless Chromium with `--use-angle=metal --enable-gpu --ignore-gpu-blocklist --force-color-profile=srgb --hide-scrollbars`. Each shot gets its own browser context at a **1920×1080 viewport and DSF 1.25**, so stills are 2400×1350. That gives the compositor 1.25× of zoom headroom with no softening. Up to 3 shots are captured in parallel.
- **App setup:** the app runs on a private stack: `PORT=8799 DATA_DIR=<empty dir> FORCE_FALLBACK=true SENTRY_DSN=` with Vite on `:5175`. An empty `DATA_DIR` is needed because the studio reopens the latest run, and an empty editor was required.
- **Shot list:** each shot defines `path`, `duration`, optional `css` (used to hide UI for the end-card shot), `prepare(ctx)`, `cursor` keys, `clicks`, `events`, `scroll(t)` and `anchors`.
  - `prepare(ctx)` helpers are `landingReady`, `preroll(seconds)` (moves virtual time without filming), `until(predicate)` (steps virtual time until the DOM is ready), `poll` (waits in real time, leaving virtual time alone), and `blockNavigation` (lets a click run its handlers without leaving the page).
  - `cursor` keys are `{at, to}`. A target is a point, `"off"`, `"hold"`, or a function that resolves a locator's centre at the moment its segment starts. The path is cubic ease-in-out with a gentle sideways bow, "as a hand moves".
  - `clicks` are times: mouse down at t, up at t + 0.08 s.
  - `events` are async hooks, for example holding virtual time until the offline engine's result is on screen.
  - `scroll(t)` gives a scroll position per subframe.
  - `anchors` are CSS selectors whose rects are recorded every 3rd subframe so the compositor's camera can track elements.
- **Per subframe (180 fps):** run due events, move the mouse, press or release, scroll, call `__vt.step(1000/180)`, write a JPEG at quality 92, and append `{m: [x, y, pressed], a: {anchors}}` to `meta.json`.
- **Safety:** a shot fails if the page contacted any host other than the app. The landing shots were allowed one font host.
- **Footage:** P 3.4 s, H 9.0 s, W 4.0 s, S 16.0 s, M 5.0 s and E 4.8 s, about 7,600 subframes and **2.8 GB** of JPEGs. `--sheet` tiles one frame every 0.25 s per shot for review.

### 3.3 The compositor (`showreel.html`)
A single WebGL2 page at 1920×1080 exposes `window.renderFrame(k)`, `window.renderAudio()` and `window.FRAMES`. It has no wall-clock state, so any frame can be re-rendered on its own.

- **Edit decision list:**
  - `SEGMENTS` maps reel time to shot time (`shot t = reel t − from`). Offsets are multiples of 1/180 s, so every reel subframe lands on a captured subframe.
  - `CUTS` lists six transitions `{at, dur, kind, a, b, dir|origin}`.
  - `END = 39.5`; after that the frame is black.
- **Motion blur:** each output frame is the average of **3 subframes** (t − 1/180, t, t + 1/180, about a 240° shutter). Each subframe is drawn with **4 camera samples** spread across its 1/180 s, so there are 12 additive passes into an RGBA16F target. Captured motion and camera moves both blur naturally.
- **Camera:** each segment has keys `[t, cx, cy, zoom]` (or `[t, anchorName, zoom, [dx, dy]]`), interpolated with a monotone cubic (Fritsch–Carlson) so there is never overshoot. The view is clamped inside the frame and zoom stays at or below about 1.3. The camera never stops: there are slow push-ins of 1.0 → 1.12 and re-framing between UI regions.
- **Overlays:** a 2D canvas per side of a transition, uploaded as a texture.
  - **Cursor:** drawn from `meta.json` as a white dot with an emerald ring and a drop shadow. It appears with a spring (0.35 s, slight overshoot), shrinks while pressed, and emits an expanding emerald ripple ring for 0.5 s after each press.
  - **Title:** an LED panel (an unlit 14 px dot grid) with per-character flicker.
  - **End-card lockup.**
- **Post-processing:** a bright-pass at half resolution, 4 separable blur passes, bloom added at 0.32, and a 20 % vignette. Grain was deliberately removed: *"per-frame noise is incompressible and multiplied the encoded size for an effect x264 then smears away."*
- **Fonts:** Inter (from `@fontsource-variable`, in `node_modules`), Geist Pixel Circle (the app's own asset, served from `/app-assets/`), and the BubbledotICG-FinePos dot display face (from onlinewebfonts). The render warns if the display face falls back.

### 3.4 The score (`lib/score.js`)
- **Rendering:** an `OfflineAudioContext` at 48 kHz stereo, 40 s long, with a fixed-seed LCG for noise, so the audio is **identical on every render**.
- **Music:** 120 BPM (one bar = 2 s), A minor, **Am–F–C–G**, one chord per bar.
- **Voices** (all synthesised):
  - kick: a sine pitch-drop through a tanh saturator;
  - hats: high-passed noise;
  - clap: three band-passed noise bursts;
  - bass: two detuned saws, low-passed, plus a sine sub;
  - pad: detuned saw triads with a reverb send;
  - pluck arpeggio: a triangle wave through a dotted-eighth feedback delay;
  - chimes: sine partials;
  - sweeps and risers: band-passed noise;
  - impacts: a sine falling from 72 to 31 Hz plus low-passed noise;
  - ticks: a 3.2 kHz sine plus a high-passed click;
  - crackle: random ticks.
- **Reverb:** a convolver whose 2.6 s impulse response is generated from noise.
- **Mix:**
  - Sidechain: the music bus ducks to 0.5 under every kick.
  - Master: a tanh soft-clip, then a fade over the last 0.35 s so the file loops cleanly.
  - Level: normalised to **−4 dBFS sample peak**. The code comment notes that AAC overshoots by about 3.5 dB, which matches the −0.4 dBTP I measured.
- **Sync:** picture events are hard-coded beside the music:
  - `CLICKS = [8.5, 10.5, 15.5, 17.0, 18.5, 21.0, 22.0, 23.5, 25.0, 26.5, 28.5]` (a tick on every click);
  - impacts at 0, 4.0 (hero reveal), 15.5 (portal), 32.25 and 39.5 (final cut);
  - chimes on the shape morphs (8.5, 10.5), on "run completed" (18.56, with a 12-note pluck flourish) and on "suite copied" (26.56);
  - a band-pass sweep for the scanner beam (12.33);
  - crackle for the LED wipe (30.75);
  - a run of rising ticks while the counters run (30.95–32.2).
- **Arrangement:**
  - bars 1–2: hook (half-time kicks, a drone, a riser);
  - bars 3–17: groove (four-on-the-floor, off-beat hats, claps on 2 and 4, eighth-note bass);
  - studio section (16–30 s): adds a 16th-note arpeggio and ghost hats;
  - bars 18–20: the drums fall away, then a pad, a riser and the last impact at 39.5.
- **Delivery:** `renderScore()` returns a base64 WAV to Node through `page.evaluate`.

### 3.5 Render and encode (`render.mjs`)
- **Frame rendering:**
  - A tiny local HTTP server serves `showreel/` and the app's fonts.
  - 2–6 headless pages (CPU count − 4) open at 1920×1080, DSF 1, and wait for `window.__ready`.
  - Workers pull frame indices from a shared counter: `renderFrame(k)`, then a JPEG screenshot at quality 97 to `out/frames/%05d.jpg`.
  - `renderAudio()` writes the WAV.
- **Master encode:**
  - `-framerate 60`, with JPEG full-range BT.601 converted to **BT.709 tv-range** and tagged (`-colorspace/-color_primaries/-color_trc bt709 -color_range tv`), otherwise browsers shift the colours;
  - `libx264 -preset slow -crf 22 -profile:v high -level 4.2 -g 120`;
  - AAC 192 kb/s, `-t 40`, `-movflags +faststart`.
- **Web cut:** `fps=30, scale=1280:720:flags=lanczos`, **two-pass** at a bitrate computed from a 9.4 MB budget: `(9.4 MiB × 8 / 40 s) − 96 kb/s audio − 40 kb/s overhead`, about 1.83 Mb/s, plus AAC 96 kb/s.
- **Review modes** (the part that makes iterating cheap):
  - `--beats`: 80 frames, one every 0.5 s (+0.25 offset), on an 8-column contact sheet;
  - `--at 4.5,18.6`: single frames;
  - `--range 15,17,0.1`: a strip of frames as a contact sheet;
  - `--audio`: the score only;
  - `--encode`: re-mux the last frames and WAV without re-rendering.
- **Thumbnail:** I could not tell how `docs/specshield-showreel-thumb.jpg` was made. No committed script writes it; it is the end-card frame with a play button added.

### 3.6 The other two tools
- **`readme-media.mjs`** crops regions of the captured shots (see `CLIPS`), redraws the reel's cursor from `meta.json`, and renders each frame on a rounded card with an emerald hairline and an optional caption bar (numeral, title, mono meta). It encodes animated WebP with `libwebp_anim`, because GitHub won't play an MP4 from a repo inside a README but does render an animated image. The hero loops seamlessly by cross-fading its tail into its head. It also renders title PNGs for the dark and light themes and WebP previews of the screenshots.
- **`record-showcase.mjs`** is an older, real-time approach. It records a CDP `Page.startScreencast` (frames arrive only when the page changes), builds an ffmpeg concat list with per-frame durations, and encodes at 30 fps 1280×800, CRF 27. The pointer is a DOM dot it injects, and the recording aborts on any outbound host, which is what backs the "0 outbound packets" claim.

---

## 4. The timeline (40.0 s, 60 fps)

Times come from `SEGMENTS`/`CUTS`/`CAMERA` and the score, and were confirmed on extracted frames.

| Reel time | Segment / cut | On screen | Camera | Sound |
|---|---|---|---|---|
| 0.00–1.30 | **Title** (drawn) | Black, an unlit emerald dot-matrix panel (14 px pitch, about 5–7 % alpha, breathing). "NDA SAYS" (white) lights letter by letter from 0.0 at 35 ms per character, with a hard LED flicker for the first 0.16 s. "NO CLOUD." (emerald) follows from 0.5. Set in the 168 px BubbledotICG dot face. A spaced mono caption, "CLIENT SPECS STAY ON THE LAPTOP", types in from 0.95 to 1.35. | locked | impact at 0, chimes at 0.02 and 0.52, a tick run, crackle at 1.3, a riser into 4.0 |
| 1.30–1.75 | **LED dot-matrix wipe**, direction (1, 0.35) | 18 px cells flip from A to B along the direction, with hash jitter; each cell lights an emerald LED as it turns | | |
| 1.30–4.40 | **P** (landing, "The Cloud QA Dilemma") | The risk card and the solution card, with the particle shield behind | 1.30 → 1.16 zoom, panning from the risk card to the solution card | |
| 3.85–4.45 | **Particle dissolve** | A burns away along fbm noise into emerald embers and lifts 40 px, revealing B | | impact and chime at 4.0: the groove starts |
| 3.80–12.80 | **H** (landing hero) | 262k particles condense into the shield. The cursor enters around 6.1 and stirs the fluid. HUD clicks at 8.5 (→ QA Matrix Lattice) and 10.5 (→ Playwright Prism checkmark) morph the particle shape. | 1.0 → 1.12 slow push, ending at 1.26 | sweep while the cursor stirs; sweep and chime on each morph |
| 12.35–12.77 | **Scanner beam** | A horizontal emerald scanline sweeps down with a wobble; scanlines trail behind it | | 9 kHz → 700 Hz sweep |
| 12.35–16.35 | **W** ("From spec to test suite in three steps") | The field morphs from the prism to the lattice. The cursor glides to the header's "Launch Studio" and presses at about 15.45; the navigation is blocked so the shot stays on the page. | 1.25 pan → 1.06 | riser |
| 15.50–16.22 | **Shield portal** from the Launch Studio button | B opens *inside the SpecShield logo shape* (a shield SDF) from the button's anchor, with an emerald rim. A dims 45 %, and both sides zoom slightly. The easing is cubicInOut^1.6, so it opens slowly and then rushes past the corners. | | impact and chime at 15.5 |
| 15.40–31.40 | **S** (the studio: the product demo) | Clicks land on the beat: 17.0 sample, 18.5 Generate (run completes at 18.56), 21.0 Security filter, 22.0 FIT-SEC-001, 23.5 Playwright tab, 25.0 login.page.ts, 26.5 Copy Suite, 28.5 Value estimate. The page then scrolls just far enough to show the estimate, and the shot ends on the privacy receipt. | 16 keys: push to 1.2 on the editor, follow the progress strip, matrix, code tabs, then the receipt, ending at 1.3 | a tick on every click; chime and pluck flourish at 18.56; 16th-note arpeggio from 16 to 30 s |
| 30.75–31.25 | **LED wipe**, direction (−1, 0.3) | | | crackle |
| 30.75–35.75 | **M** ("Nothing leaves. Nothing is billed.") | The counters run up to 100% / 0.00 / 30+ / < 15s | 1.25 → 1.06 → 1.12 | a run of rising ticks, impact at 32.25 |
| 35.00–35.60 | **Particle dissolve** | | | sweep; the drums fall away |
| 35.00–39.80 | **E** (end card) | The particle field alone (the landing UI is hidden with injected CSS) morphs from the prism back into the shield. On the left: shield mark, "SPECSHIELD" and an outlined "QA" chip at 35.75, then "KEEP THE SPEC." at 36.15 and "SHIP THE SUITE." at 36.45, revealed by a left-to-right clip in the dot face with a white→emerald gradient and glow. "100% offline · zero cloud calls · $0.00 token cost" at 37.0, then the GitHub URL in emerald mono at 37.5. | 1.0 → 1.05 | pad, riser, chime; **final impact at 39.5** |
| 39.50–40.00 | black | | | tail fades to silence (loops cleanly) |

## 5. Transition vocabulary
Each transition is one branch of a single fragment shader (`uMode`) blending shot A and shot B, both passed through their own cameras with their overlays already composited:
1. **LED dot-matrix wipe:** the brand's dot-matrix display. Linear progress, 0.45–0.5 s.
2. **Particle dissolve:** the brand's particle field. sineInOut, 0.6 s.
3. **Scanner beam:** the QA "scan". cubicInOut, 0.42 s.
4. **Shield portal (iris):** the logo itself, opening from the button that was clicked. Its origin comes from a tracked anchor. 0.72 s.

The rule is that **every transition is drawn from the product's own visual language, and the one cut that changes "place" (landing → studio) opens from the UI element that causes it.** Segments overlap each cut by a few hundred ms, so both sides are already in motion when the cut happens; the picture never pauses to transition.

## 6. Type, colour and motion rules
- **Type:** a dot or pixel display face for the big statements (title 168 px, tagline 84 px), Inter 700 with wide tracking for the wordmark, Inter 400 for the sub-line, and mono for captions and the URL. All copy is uppercase except the sub-line. Lines reveal letter by letter (LED) or with a horizontal clip wipe (end card), never with a plain fade.
- **Colour:** black ground, emerald `#10b981`/`#34d399` as the only accent, white or mint text, grey captions. Emerald is also the colour of the cursor ring, every transition rim, and the bloom.
- **Motion:**
  - expo-out reveals (0.55–0.7 s), cubic in-out for the cursor, monotone-spline camera, spring for the cursor's appearance only;
  - clicks land on beats, transitions start just before downbeats, impacts land on the cuts;
  - holds are short (about 0.5–1 s after a result before moving on).

## 7. What makes it look polished
1. **It is the real app, filmed deterministically.** Virtual time makes every frame reproducible. Review modes such as `--at`, `--range` and `--beats` let you tune a single moment without a full render.
2. **Real motion blur** (3 subframes × 4 camera samples) on both UI motion and camera motion.
3. **A camera that never stops**, framed on tracked elements (anchors) and never zoomed past the capture density (DSF 1.25), so the text stays crisp.
4. **Brand-native transitions** that come out of the UI (the portal opens from the clicked button).
5. **Overlapping segments**, so nothing ever waits on screen for a transition.
6. **A score built to the picture:** every click ticks, results chime, cuts hit impacts, the music ducks under the kick, and the ending loops.
7. **A hidden-UI end shot:** the end card reuses live footage of the hero's particle field with the page UI hidden by CSS, so the lockup sits on real motion rather than a static background.
8. **Careful delivery:** a colour-managed encode (BT.601 → BT.709 conversion plus tags), a web cut sized to the README upload limit, a faststart MP4, a thumbnail, and README media cut from the same footage.
9. **Restraint in the edit:** only 6 cuts in 40 s, one statement per beat, and no captions over the product demo. The UI carries the story.

## 8. What I could not determine
- **Thumbnail:** no committed script produces `specshield-showreel-thumb.jpg` (end card plus play button). It was probably done by hand or by an uncommitted script.
- **Font loading at render time:** the display face is loaded from `db.onlinewebfonts.com`, and I couldn't tell whether the published render actually used it or the Geist Pixel fallback. The frames look like a dot or pixel face either way.
- **Render time:** neither the render nor the capture wall-clock time is recorded anywhere. The code only logs progress.
