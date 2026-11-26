/**
 * The 9:16 cut's shots: the same timeline.mjs (and the same WAV) filmed on the app's phone layout,
 * 432×768 at DSF 3 with touch input (isMobile, hasTouch), 90 subframes a second. Only the framing
 * differs from shots.mjs. Social platforms cover the top bar, the bottom 380 px and a right rail of a
 * 1080×1920 frame, so every tap and every line of type is kept inside x 64–1016, y 220–1540 of the
 * output (page x 26–406, y 88–616 at zoom 1):
 *  - the hero scrolls its controls up into the safe zone for the Next tap, then recentres the dish;
 *  - Cook Mode's Next and Finish are swipes on the step (the app's own swipe-to-advance), because its
 *    bottom bar sits under the platform's UI; each swipe presses and releases at the very moments the
 *    16:9 click does, so the shared score's press ticks stay in sync;
 *  - the Assembly Demo uses its player driver: parked below 50 % visibility in prepare, it is scrolled
 *    fully into view on the first frame (reel 9.00), so play() starts on the beat and its phases land
 *    on the same reel times as the 16:9 scroll-scrub.
 * Hover-only features (the VIEW → tag, the tiles' COOK THIS band) correctly do not appear on touch.
 */
import { SEGMENTS, T, CLICKS, HOLDS, DRAGS, PRESS_S } from "./timeline.mjs";
import { centre, clickJs } from "./lib/shot-helpers.mjs";
import { fixtures } from "./lib/data.mjs";

const fx = fixtures();
const MARGHERITA = fx.byName(/^Classic Margherita Pizza$/);
const VCLOCK_EPOCH = Date.UTC(2026, 10, 25, 18, 30, 0);
const W = 432;

const at = (id, reel) => Math.round((reel - SEGMENTS[id].from) * 1e6) / 1e6;
const dur = (id) => Math.round((SEGMENTS[id].to - SEGMENTS[id].from + 0.06) * 90) / 90;
const ats = (id, list) => (list ?? []).map((t) => at(id, t));
/** A swipe dispatched through the mouse would select the text under it; a finger would not. */
const NO_SELECT = ".cook__stage, .cook__stage * { -webkit-user-select: none !important; user-select: none !important; }";
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
/** Scroll from a to b (document px) over reel [r0, r1], eased; `null` keeps whatever the page has. */
const glide = (id, r0, r1, a, b) => (t) => a + (b - a) * ease((t - at(id, r0)) / (at(id, r1) - at(id, r0)));

async function heroLoaded(ctx) {
  await ctx.until(() => !!document.querySelector('.dish.is-active img[src*="dummyjson"]'), "the hero's dishes");
  await ctx.ready("the hero", [".dish img"]);
}
async function introStart(ctx) {
  await heroLoaded(ctx);
  await ctx.until(() => document.documentElement.classList.contains("intro-play"), "the opening sequence", 2);
}
/** Document rect of the first element matching a selector. */
const docRect = (ctx, sel, nth = 0) =>
  ctx.js(([s, n]) => {
    const r = document.querySelectorAll(s)[n].getBoundingClientRect();
    return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + scrollY + r.height / 2 };
  }, [sel, nth]);
/** A viewport point for an element's document centre at a scroll offset the shot will have then. */
const atScroll = (sel, scroll, dx = 0, dy = 0, nth = 0) => async (ctx) => {
  const r = await docRect(ctx, sel, nth);
  return [r.cx + dx, r.cy - (typeof scroll === "function" ? scroll(ctx) : scroll) + dy];
};
/** A swipe standing in for a click: it presses and releases at the click's own times, travelling `dx`. */
const swipeFor = (id, release, from, dx) => ({ at: at(id, release - PRESS_S), dur: PRESS_S, from, to: (ctx, f) => [f.x + dx, f.y + 3] });

export const SHOTS = {
  /** Reel 1.40–9.90: the intro on the headline; the controls scroll up for the Next tap (5.43); a swipe on the dish (6.93–7.43); back up to the dish for the iris. */
  H: {
    path: "/",
    intro: true,
    duration: dur("H"),
    async prepare(ctx) {
      await introStart(ctx);
      const next = await docRect(ctx, 'button[aria-label="Next recipe"]');
      const dish = await docRect(ctx, ".dish.is-active");
      ctx.vars.low = Math.round(next.cy - 500); // the Next button 500 px down the view: inside the safe zone
      ctx.vars.dishTop = Math.round(dish.cy - 300); // the dish in the middle of the safe zone for the swipe and the iris
    },
    scroll: (t, ctx) => {
      // the headline for the intro; down to the controls for Next; up to the dish for the swipe and the iris
      const s = at("H", 3.3), e = at("H", 4.5), b = at("H", 5.75), c = at("H", 6.6);
      if (t < s) return 0;
      if (t < e) return ctx.vars.low * ease((t - s) / (e - s));
      if (t < b) return ctx.vars.low;
      if (t < c) return ctx.vars.low + (ctx.vars.dishTop - ctx.vars.low) * ease((t - b) / (c - b));
      return ctx.vars.dishTop;
    },
    cursor: [
      { at: at("H", T.heroNext - 0.4), to: atScroll('button[aria-label="Next recipe"]', (ctx) => ctx.vars.low) },
      { at: at("H", T.heroDrag.at - 0.25), to: "hold" },
      { at: at("H", T.heroDrag.at - 0.02), to: atScroll(".dish.is-active", (ctx) => ctx.vars.dishTop, 70, 20) },
      { at: at("H", SEGMENTS.H.to), to: "hold" },
    ],
    clicks: ats("H", CLICKS.H),
    drags: DRAGS.H.map((d) => ({ at: at("H", d.at), dur: d.dur, from: "hold", to: (ctx, f) => [f.x - d.frac * W, f.y + 3] })),
    anchors: {
      dish: { sel: ".dish.is-active" },
      title: { sel: "#hero-title" },
      info: { sel: ".hero__info" },
      next: { sel: 'button[aria-label="Next recipe"]' },
    },
    async verify(ctx) {
      const s = await ctx.js(() => document.querySelector(".hero__recipe .visually-hidden")?.textContent?.trim());
      if (s !== "Mango Salsa Chicken") throw new Error(`H (9:16) ended on ${s}, expected Mango Salsa Chicken`);
    },
  },

  /** Reel 9.00–18.00: the Assembly Demo's player, started on the first frame by scrolling it into view. */
  A: {
    path: "/",
    duration: dur("A"),
    async prepare(ctx) {
      await heroLoaded(ctx);
      // the slot only just on screen: enough for @defer (on viewport), far under the player's 50 % start
      await ctx.scrollTo(Math.round((await ctx.docTop(".demo-slot")) - 768 + 60));
      await ctx.until(() => !!document.querySelector('.asm__scene[data-scene="0"] .asm__photo img[src*="dummyjson"]'), "the Assembly Demo (@defer)", 8);
      await ctx.ready("the Assembly Demo", [".asm__photo img"]);
      const stage = await docRect(ctx, ".asm__stage");
      ctx.vars.view = Math.round(stage.y - 110); // fully in view, its heading below the platform's top bar
      // parked: 40 % of the stage on screen, under the player's 50 % start threshold
      await ctx.scrollTo(Math.round(stage.y - (768 - stage.h * 0.4)));
      await ctx.preroll(0.4);
      const state = await ctx.js(() => ({ driver: document.querySelector("section.asm")?.className, playing: !!document.querySelector(".asm__player .bi-pause-fill") }));
      if (!/asm--player/.test(state.driver ?? "") || state.playing) throw new Error(`A (9:16): expected a parked player, got ${JSON.stringify(state)}`);
    },
    scroll: (t, ctx) => ctx.vars.view,
    anchors: {
      stage: { sel: ".asm__stage" },
      plate: { sel: '.asm__scene[data-scene="0"] .asm__table' },
      tickets: { sel: '.asm__scene[data-scene="0"] .asm__tickets' },
      info: { sel: '.asm__scene[data-scene="0"] .asm__info' },
    },
    events: [{ at: 0.2, run: async (ctx) => ctx.mark("playing", await ctx.js(() => !!document.querySelector(".asm__player .bi-pause-fill"))) }],
    async verify(ctx, meta) {
      if (!meta.marks.playing) throw new Error("A (9:16): the player did not start on the first frame");
    },
  },

  /** Reel 17.90–22.27: the index; ITALIAN (19.00 press); a scroll to tiles 01–02. */
  I: {
    path: "/all-recipes",
    signedIn: true,
    duration: dur("I"),
    async prepare(ctx) {
      await ctx.until(() => document.querySelectorAll("button.chip").length > 10, "the index data");
      await ctx.ready("the index");
    },
    cursor: [{ at: at("I", T.italian - 0.4), to: centre((p) => p.locator("button.chip", { hasText: /^Italian$/ })) }, { at: at("I", SEGMENTS.I.to), to: "hold" }],
    clicks: ats("I", CLICKS.I),
    events: [
      {
        at: at("I", T.indexScroll[0] - 0.12),
        run: async (ctx) => {
          const tile = await docRect(ctx, "app-recipe-tile", 0);
          ctx.vars.scrollTarget = Math.round(tile.y - 130);
        },
      },
    ],
    scroll: (t, ctx) => {
      const [a, b] = [at("I", T.indexScroll[0]), at("I", T.indexScroll[1] + 0.3)];
      if (t < a || ctx.vars.scrollTarget === undefined) return 0;
      return ctx.vars.scrollTarget * ease((t - a) / (b - a));
    },
    anchors: { title: { sel: "#index-title" }, count: { sel: ".index-head__count" }, italian: { sel: "button.chip", text: "Italian" }, tile1: { sel: "app-recipe-tile", nth: 0 }, tile2: { sel: "app-recipe-tile", nth: 1 } },
  },

  /** Reel 21.60–27.88: Surprise me (23.14 press), the wheel stops on 26.00, COOK THIS is held at 27.00. */
  S: {
    path: "/all-recipes",
    signedIn: true,
    duration: dur("S"),
    async prepare(ctx) {
      await ctx.until(() => document.querySelectorAll("button.chip").length > 10, "the index data");
      await ctx.ready("the index");
      await clickJs("button.chip", "Italian")(ctx);
      await ctx.preroll(1.4);
      await ctx.ready("the Italian index");
      ctx.vars.winnerImage = MARGHERITA.image;
    },
    cursor: [
      { at: at("S", T.surprise - 0.5), to: centre((p) => p.locator("button.surprise")) },
      { at: at("S", T.resultCard + 0.1), to: "hold" },
      { at: at("S", T.cookThisPress - 0.2), to: centre((p) => p.locator(".spin__actions a.btn-cwm").first()) },
      { at: at("S", SEGMENTS.S.to), to: "hold" },
    ],
    rand: [{ at: at("S", T.surprise - 0.3), values: [0.25, 0.6] }],
    clicks: ats("S", CLICKS.S),
    holds: ats("S", HOLDS.S),
    events: [
      {
        at: at("S", T.surprise) + 1 / 90,
        run: async (ctx) => {
          await ctx.settle(() => !!document.querySelector("dialog.spin[open] .spin__ring")?.getAnimations().length, "the wheel to spin");
          ctx.mark("spinStart", at("S", T.surprise));
        },
      },
      {
        at: at("S", T.spinStart + T.spinMs / 1000) + 2 / 90,
        run: async (ctx) => {
          const s = await ctx.js(() => {
            const ring = document.querySelector(".spin__ring");
            return ring ? { rot: parseFloat(getComputedStyle(ring).rotate) || 0, dishes: [...ring.querySelectorAll(".spin__dish img")].map((i) => i.currentSrc) } : null;
          });
          if (!s) throw new Error("S (9:16): the wheel was gone before it landed");
          const slot = s.dishes.findIndex((src) => src === ctx.vars.winnerImage);
          const angle = ((((slot * 360) / s.dishes.length + s.rot) % 360) + 360) % 360;
          ctx.mark("landing", { rotation: s.rot, slot, offMarkerDeg: Math.round(Math.min(angle, 360 - angle) * 1000) / 1000, count: s.dishes.length });
          if (slot < 0 || Math.min(angle, 360 - angle) > 0.5) throw new Error(`S (9:16): landed ${angle}° off the marker`);
        },
      },
      {
        // the result card scrolls inside the dialog on a phone: bring Cook this into the safe zone
        at: at("S", T.resultCard) + 2 / 90,
        run: (ctx) => ctx.js(() => {
          const d = document.querySelector("dialog.spin");
          const b = document.querySelector(".spin__actions a.btn-cwm");
          if (d && b) d.scrollTop = Math.max(0, b.offsetTop - 360);
        }),
      },
    ],
    anchors: { surprise: { sel: "button.surprise" }, panel: { sel: "dialog.spin .spin__panel" }, wheel: { sel: ".spin__disc" }, photo: { sel: ".spin__photo" }, name: { sel: ".spin__name" }, cook: { sel: ".spin__actions a.btn-cwm" } },
    async verify(ctx, meta) {
      const name = await ctx.js(() => document.querySelector(".spin__name")?.textContent?.trim());
      if (name !== MARGHERITA.name) throw new Error(`S (9:16): the result card says ${name}`);
      if (meta.rand.filter((r) => r.scripted).map((r) => r.value).join() !== "0.25,0.6") throw new Error("S (9:16): scripted randomness not consumed as planned");
    },
  },

  /** Reel 26.90–35.27: the detail page, SAVE, START COOKING, two swipes forward, the drawer, two checks. */
  DC: {
    path: `/view-recipe/${MARGHERITA._id}`,
    signedIn: true,
    duration: dur("DC"),
    // the swipes go through the mouse (see capture.mjs); a finger never selects the step's text, so neither may they
    css: NO_SELECT,
    async prepare(ctx) {
      await ctx.until(() => !!document.querySelector('.feature__photo img[src*="dummyjson"]') && !!document.querySelector("#recipe-title"), "the detail page");
      await ctx.ready("the detail page");
      ctx.vars.top = 64; // the actions up into the safe zone
      await ctx.scrollTo(ctx.vars.top);
      await ctx.ready("the detail page", [".feature__photo img"]);
    },
    scroll: (t, ctx) => (t < at("DC", T.startCooking) ? ctx.vars.top : null),
    cursor: [
      { at: at("DC", T.save - 0.45), to: atScroll(".feature__save", (ctx) => ctx.vars.top) },
      { at: at("DC", T.save + 0.3), to: "hold" },
      { at: at("DC", T.startCooking - 0.45), to: atScroll(".feature__cook", (ctx) => ctx.vars.top) },
      { at: at("DC", T.startCooking + 0.2), to: "hold" },
      { at: at("DC", T.cookNext1 - 0.4), to: centre((p) => p.locator("dialog.cook .cook__panel.is-on:not(.is-top) .cook__words"), 60, 0) },
      { at: at("DC", T.cookNext1 + 0.2), to: "hold" },
      { at: at("DC", T.cookNext2 - 0.4), to: centre((p) => p.locator("dialog.cook .cook__panel.is-on:not(.is-top) .cook__words"), 60, 0) },
      { at: at("DC", T.cookNext2 + 0.2), to: "hold" },
      { at: at("DC", T.ingredients - 0.35), to: centre((p) => p.locator(".cook__btn--mid")) },
      { at: at("DC", T.ingredients + 0.05), to: "hold" },
      { at: at("DC", T.check1 - 0.12), to: centre((p) => p.locator(".cook__drawer .check .check__box").nth(2), 2, 2) },
      { at: at("DC", T.check1 + 0.05), to: "hold" },
      { at: at("DC", T.check2 - 0.12), to: centre((p) => p.locator(".cook__drawer .check .check__box").nth(3), 2, 2) },
      { at: at("DC", SEGMENTS.DC.to), to: "hold" },
    ],
    clicks: ats("DC", [T.save, T.startCooking, T.ingredients, T.check1, T.check2]),
    drags: [swipeFor("DC", T.cookNext1, "hold", -150), swipeFor("DC", T.cookNext2, "hold", -150)],
    events: [
      { at: at("DC", T.save) + 1 / 90, run: (ctx) => ctx.settle(() => /Saved/.test(document.querySelector(".feature__save")?.textContent ?? ""), "the save to land") },
      { at: at("DC", T.startCooking) + 1 / 90, run: (ctx) => ctx.settle(() => !!document.querySelector("dialog.cook[open] .cook__panel.is-on .cook__words"), "Cook Mode to open") },
    ],
    anchors: {
      title: { sel: "#recipe-title" },
      facts: { sel: "dl.facts" },
      save: { sel: ".feature__save" },
      numeral: { sel: "dialog.cook .cook__panel.is-on:not(.is-top) .cook__n" },
      words: { sel: "dialog.cook .cook__panel.is-on:not(.is-top) .cook__words" },
      drawer: { sel: "dialog.cook .cook__drawer" },
    },
    async verify(ctx) {
      const s = await ctx.js(() => ({
        step: document.querySelector("dialog.cook .cook__count")?.textContent?.replace(/\s+/g, " ").trim(),
        checked: [...document.querySelectorAll("dialog.cook .cook__drawer .check")].map((b) => b.getAttribute("aria-pressed")),
      }));
      if (!/Step 3 of 6/.test(s.step ?? "")) throw new Error(`DC (9:16) ended on "${s.step}"`);
      if (s.checked.join() !== "false,false,true,true,false,false") throw new Error(`DC (9:16) checks: ${s.checked}`);
    },
  },

  /** Reel 34.60–38.40: Cook Mode resumed at STEP 06/06; a swipe at the Finish click's times → NICE ONE. */
  C2: {
    path: `/view-recipe/${MARGHERITA._id}?cook=1`,
    signedIn: true,
    init: { local: { [`cwm.cook.v1.${MARGHERITA._id}`]: JSON.stringify({ t: VCLOCK_EPOCH - 10 * 60 * 1000, v: { step: 5, total: 6, name: MARGHERITA.name } }) } },
    duration: dur("C2"),
    css: NO_SELECT,
    async prepare(ctx) {
      await ctx.until(() => !!document.querySelector("dialog.cook[open] .cook__panel.is-on .cook__words"), "Cook Mode", 8);
      await ctx.ready("Cook Mode");
      await ctx.preroll(0.6);
    },
    cursor: [{ at: at("C2", T.finish - 0.45), to: centre((p) => p.locator("dialog.cook .cook__panel.is-on:not(.is-top) .cook__words"), 60, 0) }, { at: at("C2", SEGMENTS.C2.to), to: "hold" }],
    drags: [swipeFor("C2", T.finish, "hold", -150)],
    anchors: { nice: { sel: "dialog.cook .cook__nice" }, lede: { sel: "dialog.cook .cook__lede" }, words: { sel: "dialog.cook .cook__panel.is-on:not(.is-top) .cook__words" } },
    async verify(ctx) {
      const s = await ctx.js(() => document.querySelector(".cook__nice")?.textContent?.trim());
      if (!/Nice one\./i.test(s ?? "")) throw new Error(`C2 (9:16) finish screen: ${s}`);
    },
  },

  /** Reel 37.40–40.40: Your Collections; the page scrolls to Margherita, saved last. */
  K: {
    path: "/saved-recipes",
    signedIn: true,
    duration: dur("K"),
    async prepare(ctx) {
      await ctx.until(() => document.querySelectorAll(".saved__grid img").length >= 4, "the collection");
      await ctx.poll(() => ctx.js(() => document.fonts.status === "loaded"), "the fonts");
      const last = await docRect(ctx, ".saved__grid > li", 3);
      ctx.vars.last = Math.round(last.y - 120);
    },
    scroll: (t, ctx) => {
      const [a, b] = [at("K", 38.35), at("K", 39.3)];
      if (t < a) return 0;
      return ctx.vars.last * ease((t - a) / (b - a));
    },
    anchors: { title: { sel: "#saved-title" }, last: { sel: ".saved__grid > li", nth: 3 } },
  },

  /** Reel 39.40–44.77: the end card on the real hero: headline at the top, the platter below. */
  E: {
    path: "/",
    intro: true,
    duration: dur("E"),
    css: `
      .site-header, app-navbar, .skip-link { display: none !important; }
      .hero .kicker, .hero__lede, .hero__cta { display: none !important; }
      .hero__info, .hero__controls { visibility: hidden !important; }
      /* room above the real headline for the drawn wordmark, clear of the platform's top bar; and side
         padding so the headline (and the lockup aligned to it) sits inside the 64 px safe margin */
      .hero__type { padding-top: 150px !important; padding-left: 26px !important; padding-right: 26px !important; }
      .cursor-tag { display: none !important; }
    `,
    prepare: introStart,
    events: [{ at: at("E", T.endPrevious), run: clickJs('button[aria-label="Previous recipe"]') }],
    anchors: { title: { sel: "#hero-title" }, dish: { sel: ".dish.is-active" }, disc: { sel: ".hero__disc" } },
    async verify(ctx) {
      const s = await ctx.js(() => document.querySelector(".hero__recipe .visually-hidden")?.textContent?.trim());
      if (s !== "Chicken Alfredo Pasta") throw new Error(`E (9:16) ended on ${s}`);
    },
  },
};
