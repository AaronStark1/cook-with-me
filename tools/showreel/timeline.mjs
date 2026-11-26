/**
 * THE edit decision list for the 45-second Cook With Me reel. One source of truth, imported by
 * the shot lists (shots.mjs, shots-vertical.mjs), the compositor (reel.html) and the score
 * (lib/score.js): every beat, segment, cut, click, drag, caption and sound cue lives here, in
 * reel seconds. A plain ES module with no imports, so Node and the page load the same file.
 *
 * The grid is 120 BPM: a bar is 2.0 s, a beat 0.5 s, downbeats on even seconds. The app's wipe
 * curve rushes (coverage 0.55) at 58.3 % of its run, so a wipe that should hit a beat starts at
 * beat − 0.583 × its duration (970 ms → −0.57 s, 640 ms → −0.37 s, 900 ms iris → −0.52 s).
 *
 * Segment `from` values are multiples of 1/90 s, so every reel subframe lands exactly on a
 * captured subframe in both cuts (16:9 films 180 subframes/s, 9:16 films 90).
 */

export const DURATION = 45.0;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const FPS = { "16x9": 60, "9x16": 30 };
export const SUB_FPS = { "16x9": 180, "9x16": 90 };

/**
 * A click: the button goes down PRESS_S before it comes up, and the app acts on the release. The
 * score ticks on the press (when a real click sounds), so a click meant to land on a beat presses
 * on the beat and releases PRESS_S later; a click that starts a wipe releases on the wipe's start.
 */
export const PRESS_S = 0.06;
const onBeat = (beat) => Math.round((beat + PRESS_S) * 1e6) / 1e6;

/** Fraction of a wipe's run where cover() crosses 0.55 (the rush). */
export const RUSH = 0.583;
export const D_HERO = 0.97;
export const D_STEP = 0.64;
export const D_IRIS = 0.9;
export const D_SPIN = 0.97;
export const rushOf = (start, dur) => start + RUSH * dur;

// ------------------------------------------------------------------------------- picture events
/** Where the app's own motion happens, in reel seconds (clicks are the button's release: the app acts then). */
export const T = {
  // TITLE (drawn)
  titlePlateIn: [0.0, 0.9],
  titleIris: [0.35, 1.25],
  titleWords: 0.15, // "WHAT'S FOR" mask-rises, 70 ms per word
  titleBlock: [0.55, 0.8], // the yolk block wipes in
  titleDinner: 0.8, // "DINNER?" rises inside it

  // H — the hero, signed out, first visit (the opening sequence plays)
  heroIntro: 1.4, // the shot opens on the intro's first frame
  // Next comes BEFORE the drag (the brief has them the other way round): in the app, the first click
  // inside the carousel after a drag is swallowed (bindDrag's `moved` flag is only cleared by a click,
  // and a captured drag produces none), so a Next pressed after the drag would do nothing.
  heroCursorIn: [4.3, 4.9], // enters bottom-right, onto the controls (hover pauses autoplay)
  heroNext: 5.43, // → paprika, rush 6.00
  heroToDish: [5.85, 6.6], // to the dish: the app's VIEW → tag follows the cursor
  heroDrag: { at: 6.93, dur: 0.5, frac: 0.42 }, // press on the dish, drag left 0.42 × hero width, release
  heroDragRelease: 7.43, // → beet, rush 8.00
  heroCursorOut: [8.6, 9.9],

  // A — the Assembly Demo, scroll-scrubbed at a constant 1× (demo ms = (reel − 9.00) × 1000)
  asmStart: 9.0,
  asmPhases: { set: 9.0, gather: 9.6, converge: 11.6, build: 13.0, orbit: 14.2, present: 16.0, hold: 17.0 },
  asmJoin: 13.0,
  asmIris: [13.0, 13.9],
  asmTickets: 8, // tickets on screen (Bibimbap has 10 ingredients: 8 + "+2 more")

  // I — the index, signed in
  italian: onBeat(19.0),
  indexScroll: [19.5, 20.4],
  tileHover: 20.8,

  // S — Surprise me (Italian preselected)
  surprise: 23.2,
  /** The wheel starts on the press's own frame (the dialog's chunk and render settle at zero virtual time)
   *  and spins 2.8 s, so it stops on the 26.00 downbeat. */
  spinStart: 23.2,
  spinMs: 2800,
  resultCard: 23.2 + 2.8 + 0.35, // the app reveals the card 350 ms after the wheel stops
  cookThisPress: 27.0, // pressed; the plate iris cuts to the detail page (see CUTS)

  // D — the detail page, then Cook Mode (one continuous shot)
  save: onBeat(28.5),
  startCooking: onBeat(29.5),
  cookNext1: 30.63, // → paprika 02, rush 31.00
  cookNext2: 31.63, // → beet 03, rush 32.00
  ingredients: onBeat(32.5),
  check1: onBeat(33.0), // Fresh mozzarella cheese
  check2: onBeat(33.5), // Fresh basil leaves

  // C2 — Cook Mode resumed at step 06/06
  finish: 35.63, // → NICE ONE. + DONE stamp, rush 36.00

  // E — the end card on the real hero
  endWordmark: 40.3,
  endKicker: 41.5,
  endUrl: 42.0,
  endPrevious: 42.43, // a back wipe, tomato to tomato, rush 43.00
  finalHit: 44.0,
  toBroth: 44.13, // out to flat broth (rush 44.50): the reel ends where it began
};

/** Every press, in reel seconds (the release; the button went down PRESS_S before). */
export const CLICKS = {
  H: [T.heroNext],
  I: [T.italian],
  S: [T.surprise],
  DC: [T.save, T.startCooking, T.cookNext1, T.cookNext2, T.ingredients, T.check1, T.check2],
  C2: [T.finish],
};
/** Presses that are never released inside the footage (the cut carries the action). */
export const HOLDS = { S: [T.cookThisPress] };
export const DRAGS = { H: [T.heroDrag] };

// --------------------------------------------------------------------------------------- the edit
/** Reel time → shot time (shot t = reel t − from). `to` is the last reel second the segment is used. */
export const SEGMENTS = {
  title: { from: 0, to: 2.4 },
  H: { shot: "H", from: 1.4, to: 9.9 },
  A: { shot: "A", from: 9.0, to: 18.0 },
  I: { shot: "I", from: 17.9, to: 22.27 },
  S: { shot: "S", from: 21.6, to: 27.88 },
  DC: { shot: "DC", from: 26.9, to: 35.27 },
  C2: { shot: "C2", from: 34.6, to: 38.4 },
  K: { shot: "K", from: 37.4, to: 40.4 },
  E: { shot: "E", from: 39.4, to: 44.77 },
  broth: { from: 44.13, to: DURATION },
};

/**
 * Transitions, all from the app's own motion language (brief §7):
 *   wipe    §7.1 the field wipe (the hero / route / Cook Mode wipe), dir +1 forward, −1 back
 *   iris    §7.2 the plate iris, opening from an anchor in A
 *   deal    §7.3 the ticket deal (Bibimbap's real ingredients), full cover at `cover`
 *   platter §7.4 the platter spin (the hero's lazy-Susan maths on whole frames)
 */
export const CUTS = [
  { id: "T1", kind: "wipe", at: 1.43, dur: D_HERO, a: "title", b: "H", dir: 1 },
  { id: "T2", kind: "iris", at: 9.0, dur: D_IRIS, a: "H", b: "A", origin: ["H", "dish"] },
  // 17.30, not 17.40: with a 40 ms stagger the ten base tickets must start by 17.66 to have landed
  // (≥ 99 %) at the 18.00 swap, so coverage holds without giant tickets
  { id: "T3", kind: "deal", at: 17.3, dur: 1.2, a: "A", b: "I", cover: 18.0 },
  { id: "T4", kind: "wipe", at: 21.63, dur: D_STEP, a: "I", b: "S", dir: 1 },
  { id: "T4b", kind: "iris", at: 26.98, dur: D_IRIS, a: "S", b: "DC", origin: ["S", "photo"] },
  { id: "T5", kind: "wipe", at: 34.63, dur: D_STEP, a: "DC", b: "C2", dir: 1 },
  { id: "T6", kind: "platter", at: 37.43, dur: D_SPIN, a: "C2", b: "K" },
  { id: "T7", kind: "wipe", at: 39.43, dur: D_HERO, a: "K", b: "E", dir: -1 },
  { id: "T8", kind: "wipe", at: T.toBroth, dur: D_STEP, a: "E", b: "broth", dir: 1 },
];
/** Flat fields the compositor draws (no footage). */
export const FIELDS = { title: "#1C0F0A", broth: "#1C0F0A" };

/** In-app wipes the score answers with a whoosh, as [start, duration, direction] in reel seconds. */
export const APP_WIPES = [
  [T.heroNext, D_HERO, 1],
  [T.heroDragRelease, D_HERO, 1],
  [T.cookNext1, D_STEP, 1],
  [T.cookNext2, D_STEP, 1],
  [T.finish, D_STEP, 1],
  [T.endPrevious, D_HERO, -1],
];

/** Captions: on in 9:16 (social plays muted), off in 16:9 except the title and the end card. ≤ 4 words, all true. */
export const CAPTIONS = [
  { text: "SPIN THE PLATTER", from: 4.5, to: 7.4 },
  { text: "FILTER BY CUISINE", from: 18.6, to: 21.4 },
  { text: "CAN'T DECIDE? SPIN.", from: 22.6, to: 25.9 },
  { text: "SAVE IT. COOK IT.", from: 28.3, to: 30.4 },
  { text: "STEP-BY-STEP COOK MODE", from: 30.6, to: 34.4 },
];

export const TITLE = { line1: ["WHAT'S", "FOR"], line2: "DINNER?" };
export const END_CARD = { kicker: "DISCOVER · SAVE · COOK", url: "github.com/AaronStark1/cook-with-me" };

/** Shot time for a reel time in a segment. */
export const shotTime = (segment, reel) => Math.round((reel - SEGMENTS[segment].from) * 1e6) / 1e6;
/** Reel time for a shot time. */
export const reelTime = (segment, shot) => Math.round((shot + SEGMENTS[segment].from) * 1e6) / 1e6;

/** Checks the edit's own rules (run by render.mjs before anything is drawn). */
export function validateTimeline() {
  const problems = [];
  for (const [id, s] of Object.entries(SEGMENTS)) {
    if (s.shot && Math.abs(s.from * 90 - Math.round(s.from * 90)) > 1e-6) problems.push(`segment ${id} starts at ${s.from}, not a multiple of 1/90 s`);
  }
  for (const c of CUTS) {
    const a = SEGMENTS[c.a], b = SEGMENTS[c.b];
    if (!a || !b) problems.push(`cut ${c.id} names a missing segment`);
    else {
      if (a.to < c.at + (c.kind === "deal" ? c.cover - c.at : c.dur) - 1e-6) problems.push(`cut ${c.id}: ${c.a} ends at ${a.to}, before the cut needs it`);
      const needed = c.kind === "deal" ? c.cover : c.at; // the deal swaps under full cover
      if (b.from > needed + 1e-6) problems.push(`cut ${c.id}: ${c.b} starts at ${b.from}, after the cut needs it`);
    }
  }
  return problems;
}
