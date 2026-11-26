/**
 * The 16:9 reel's shots: what capture.mjs films in the real app at 1600×900 (DSF 1.5), 180
 * subframes a second. Every time here comes from timeline.mjs (reel seconds) and is converted to
 * shot time with `at(segment, reel)`: nothing is typed twice. `cursor` keys glide between targets
 * (a target resolves when its segment starts; "hold" stays where the pointer is), `clicks` are
 * releases (the button went down PRESS_S before), `holds` are presses never released inside the
 * footage, `drags` press, move every subframe on an ease-out and release, `events` run scripted
 * hooks that wait in real time but never move virtual time, and `anchors` are element rects
 * recorded every third subframe for the compositor's camera and transitions.
 */
import { SEGMENTS, T, CLICKS, HOLDS, DRAGS } from "./timeline.mjs";
import { centre, asmGeometry, asmScrollFor, clickJs } from "./lib/shot-helpers.mjs";
import { fixtures } from "./lib/data.mjs";

const fx = fixtures();
export const MARGHERITA = fx.byName(/^Classic Margherita Pizza$/);
const VCLOCK_EPOCH = Date.UTC(2026, 10, 25, 18, 30, 0);

/** Shot time of a reel time in segment `id`. */
export const at = (id, reel) => Math.round((reel - SEGMENTS[id].from) * 1e6) / 1e6;
/** A segment's footage length: its reel span plus a few subframes of slack. */
const dur = (id) => Math.round((SEGMENTS[id].to - SEGMENTS[id].from + 0.06) * 90) / 90;
const ats = (id, list) => (list ?? []).map((t) => at(id, t));

/** Steps until the hero's real first dish (not the empty-state plate) is bound and loaded. */
async function heroLoaded(ctx) {
  await ctx.until(() => !!document.querySelector('.dish.is-active img[src*="dummyjson"]'), "the hero's dishes");
  await ctx.ready("the hero", [".dish img"]);
}

/** The opening sequence's first frame: stop the instant <html> switches to intro-play. */
async function introStart(ctx) {
  await heroLoaded(ctx);
  await ctx.until(() => document.documentElement.classList.contains("intro-play"), "the opening sequence", 2);
}

/**
 * A cursor target at an element's layout place: offsetLeft/offsetTop summed up the offsetParent
 * chain, which no transform or translate affects, so it is where the element will rest once a
 * slide-in (the Cook Mode drawer) or a FLIP has finished. Fixed (and top-layer) ancestors are
 * viewport-relative; otherwise the page scroll is taken off.
 */
const layoutCentre = (selector, nth = 0, dx = 0, dy = 0) => async (ctx) =>
  ctx.js(
    ([s, n, ox, oy]) => {
      const el = document.querySelectorAll(s)[n];
      if (!el) throw new Error(`no ${s} #${n}`);
      let x = 0, y = 0, node = el, fixed = false;
      while (node) {
        x += node.offsetLeft;
        y += node.offsetTop;
        if (getComputedStyle(node).position === "fixed") fixed = true;
        node = node.offsetParent;
      }
      if (!fixed) { x -= window.scrollX; y -= window.scrollY; }
      return [x + el.offsetWidth / 2 + ox, y + el.offsetHeight / 2 + oy];
    },
    [selector, nth, dx, dy],
  );

const heroAnchors = {
  dish: { sel: ".dish.is-active" },
  disc: { sel: ".hero__disc" },
  title: { sel: "#hero-title" },
  info: { sel: ".hero__info" },
  controls: { sel: ".hero__controls" },
  next: { sel: 'button[aria-label="Next recipe"]' },
};

export const SHOTS = {
  /** Reel 1.40–9.90: the hero, signed out, first visit. The intro plays from the first frame; the
   *  cursor enters onto the controls and presses Next, rests on the dish (VIEW →), drags the platter
   *  one dish forward and leaves. */
  H: {
    path: "/",
    intro: true,
    duration: dur("H"),
    prepare: introStart,
    cursor: [
      { at: at("H", T.heroCursorIn[0]), to: [1560, 935] },
      { at: at("H", T.heroCursorIn[1]), to: centre((p) => p.getByRole("button", { name: "Next recipe" }), 4, 3) },
      { at: at("H", T.heroToDish[0]), to: "hold" },
      { at: at("H", T.heroToDish[1]), to: centre((p) => p.locator(".dish.is-active"), -60, -40) },
      { at: at("H", T.heroDrag.at), to: "hold" },
      { at: at("H", T.heroDragRelease), to: "hold" },
      { at: at("H", T.heroCursorOut[0]), to: "hold" },
      { at: at("H", T.heroCursorOut[1]), to: [1720, 1010] },
    ],
    drags: DRAGS.H.map((d) => ({
      at: at("H", d.at),
      dur: d.dur,
      from: "hold",
      to: (ctx, from) => [from.x - d.frac * 1600, from.y + 6],
    })),
    clicks: ats("H", CLICKS.H),
    anchors: heroAnchors,
    async verify(ctx, meta) {
      const s = await ctx.js(() => document.querySelector(".hero__recipe .visually-hidden")?.textContent?.trim());
      if (s !== "Mango Salsa Chicken") throw new Error(`H ended on ${s}, expected Mango Salsa Chicken (drag + Next = two steps; an unscripted advance?)`);
      meta.marks.endRecipe = s;
    },
  },

  /** Reel 9.00–18.00: the Assembly Demo, scroll-scrubbed at a constant 1×: demo ms = (reel − 9.00) × 1000. */
  A: {
    path: "/",
    duration: dur("A"),
    async prepare(ctx) {
      await heroLoaded(ctx);
      await ctx.scrollTo(await ctx.docTop(".demo-slot"));
      await ctx.until(() => !!document.querySelector('.asm__scene[data-scene="0"] .asm__photo img[src*="dummyjson"]'), "the Assembly Demo (@defer)", 8);
      // the iris must open on the photo, never the plate fallback: decode all three showcase photos first
      await ctx.ready("the Assembly Demo", [".asm__photo img"]);
      ctx.vars.geo = await asmGeometry(ctx);
      await ctx.scrollTo(asmScrollFor(ctx.vars.geo, 0));
      await ctx.preroll(0.3);
      await ctx.ready("the Assembly Demo at 0 ms", [".asm__photo img"]);
    },
    scroll: (t, ctx) => asmScrollFor(ctx.vars.geo, t * 1000),
    anchors: {
      stage: { sel: ".asm__stage" },
      plate: { sel: '.asm__scene[data-scene="0"] .asm__table' },
      tickets: { sel: '.asm__scene[data-scene="0"] .asm__tickets' },
      info: { sel: '.asm__scene[data-scene="0"] .asm__info' },
      name: { sel: '.asm__scene[data-scene="0"] .asm__name' },
      title: { sel: ".asm__head" },
      chrome: { sel: ".asm__chrome" },
    },
    async verify(ctx, meta) {
      const s = await ctx.js(() => ({
        name: document.querySelector('.asm__scene[data-scene="0"] .asm__name')?.textContent?.trim(),
        hint: !!document.querySelector(".asm__hint"),
      }));
      if (s.name !== "Korean Bibimbap") throw new Error(`A shows ${s.name}`);
      meta.marks.hint = s.hint;
    },
  },

  /** Reel 17.90–22.27: the index, signed in. ALL RECIPES masks in; ITALIAN (19.00) narrows 30 → 06;
   *  the page scrolls to the six tiles; the cursor rests on tile 02 (Margherita) and its band rises. */
  I: {
    path: "/all-recipes",
    signedIn: true,
    duration: dur("I"),
    async prepare(ctx) {
      await ctx.until(() => document.querySelectorAll("button.chip").length > 10, "the index data");
      await ctx.ready("the index");
    },
    cursor: [
      { at: at("I", 18.3), to: [1640, 470] },
      { at: at("I", T.italian - 0.12), to: centre((p) => p.locator("button.chip", { hasText: /^Italian$/ })) },
      { at: at("I", T.indexScroll[0] - 0.1), to: "hold" },
      {
        at: at("I", T.tileHover - 0.05),
        // where tile 02's photo will be once the scroll has landed
        to: async (ctx) => {
          const p = await layoutCentre("app-recipe-tile .tile__photo", 1, -30, -20)(ctx);
          const y = await ctx.js(() => window.scrollY);
          return [p[0], p[1] - (ctx.vars.scrollTarget - y)];
        },
      },
      { at: at("I", SEGMENTS.I.to), to: "hold" },
    ],
    clicks: ats("I", CLICKS.I),
    events: [
      {
        at: at("I", T.indexScroll[0] - 0.12),
        run: async (ctx) => {
          // land with both rows of the six Italian tiles in view, just under the header
          ctx.vars.scrollTarget = await ctx.js(() => {
            const grid = document.querySelector("ul.grid");
            return Math.round(grid.getBoundingClientRect().top + window.scrollY - 68 - 28);
          });
        },
      },
    ],
    scroll: (t, ctx) => {
      const [a, b] = [at("I", T.indexScroll[0]), at("I", T.indexScroll[1])];
      if (t < a || ctx.vars.scrollTarget === undefined) return 0;
      const u = Math.min(1, (t - a) / (b - a));
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      return ctx.vars.scrollTarget * e;
    },
    anchors: {
      title: { sel: "#index-title" },
      count: { sel: ".index-head__count" },
      italian: { sel: "button.chip", text: "Italian" },
      chips: { sel: ".filters" },
      grid: { sel: "ul.grid" },
      tile2: { sel: "app-recipe-tile", nth: 1 },
    },
    async verify(ctx, meta) {
      const n = await ctx.js(() => document.querySelectorAll("ul.grid > li:not([data-flip-leaving])").length);
      if (n !== 6) throw new Error(`I: ${n} tiles after the Italian filter, expected 6`);
    },
  },

  /** Reel 21.60–27.88: Surprise me over the six Italian dishes. Math.random is scripted so the
   *  winner is Classic Margherita Pizza in 4 turns; the wheel stops on the 26.00 downbeat; the
   *  cursor presses COOK THIS at 27.00 and the plate iris carries the action to the detail page. */
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
      { at: 0, to: [780, 440] },
      { at: at("S", T.surprise - 0.6), to: "hold" },
      { at: at("S", T.surprise - 0.1), to: centre((p) => p.locator("button.surprise"), -10, 2) },
      { at: at("S", T.resultCard + 0.1), to: "hold" },
      { at: at("S", T.cookThisPress - 0.06), to: centre((p) => p.locator(".spin__actions a.btn-cwm").first(), -14, 2) },
      { at: at("S", SEGMENTS.S.to), to: "hold" },
    ],
    rand: [{ at: at("S", T.surprise - 0.3), values: [0.25, 0.6] }],
    clicks: ats("S", CLICKS.S),
    holds: ats("S", HOLDS.S),
    events: [
      {
        // the next subframe after the press: let the lazy dialog load and start spinning at the press's own moment
        at: at("S", T.surprise) + 1 / 180,
        run: async (ctx) => {
          await ctx.settle(() => !!document.querySelector("dialog.spin[open] .spin__ring")?.getAnimations().length, "the wheel to spin");
          ctx.mark("spinStart", at("S", T.surprise));
        },
      },
      {
        at: at("S", T.spinStart + T.spinMs / 1000) + 2 / 180,
        run: async (ctx) => {
          const s = await ctx.js(() => {
            const ring = document.querySelector(".spin__ring");
            return ring ? { rot: parseFloat(getComputedStyle(ring).rotate) || 0, dishes: [...ring.querySelectorAll(".spin__dish img")].map((i) => i.currentSrc) } : null;
          });
          if (!s) throw new Error("S: the wheel was gone before it landed");
          const slot = s.dishes.findIndex((src) => src === ctx.vars.winnerImage);
          const angle = ((((slot * 360) / s.dishes.length + s.rot) % 360) + 360) % 360;
          ctx.mark("landing", { rotation: s.rot, slot, offMarkerDeg: Math.round(Math.min(angle, 360 - angle) * 1000) / 1000, count: s.dishes.length });
          if (slot < 0 || Math.min(angle, 360 - angle) > 0.5) throw new Error(`S: landed ${angle}° off the marker (slot ${slot})`);
        },
      },
    ],
    anchors: {
      surprise: { sel: "button.surprise" },
      panel: { sel: "dialog.spin .spin__panel" },
      wheel: { sel: ".spin__disc" },
      marker: { sel: ".spin__marker" },
      photo: { sel: ".spin__photo" },
      name: { sel: ".spin__name" },
      cook: { sel: ".spin__actions a.btn-cwm" },
      count: { sel: ".index-head__count" },
    },
    async verify(ctx, meta) {
      const name = await ctx.js(() => document.querySelector(".spin__name")?.textContent?.trim());
      if (name !== MARGHERITA.name) throw new Error(`S: the result card says ${name}`);
      const scripted = meta.rand.filter((r) => r.scripted).map((r) => r.value);
      if (scripted.join() !== "0.25,0.6") throw new Error(`S: scripted randomness not consumed as planned: ${JSON.stringify(meta.rand)}`);
    },
  },

  /** Reel 26.90–35.27: the detail page (deep link) then Cook Mode, one continuous shot. SAVE (28.50)
   *  stamps SAVED; START COOKING (29.50) opens Cook Mode; two Nexts wipe to 02 and 03; the drawer
   *  opens and two ingredients are ticked. */
  DC: {
    path: `/view-recipe/${MARGHERITA._id}`,
    signedIn: true,
    duration: dur("DC"),
    async prepare(ctx) {
      await ctx.until(() => !!document.querySelector('.feature__photo img[src*="dummyjson"]') && !!document.querySelector("#recipe-title"), "the detail page");
      await ctx.ready("the detail page", [".feature__photo img"]);
    },
    cursor: [
      { at: at("DC", 27.9), to: [760, 840] },
      { at: at("DC", T.save - 0.12), to: centre((p) => p.locator(".feature__save"), -6, 2) },
      { at: at("DC", T.save + 0.3), to: "hold" },
      { at: at("DC", T.startCooking - 0.12), to: centre((p) => p.locator(".feature__cook"), -30, 2) },
      { at: at("DC", T.startCooking + 0.25), to: "hold" },
      { at: at("DC", T.cookNext1 - 0.12), to: centre((p) => p.locator(".cook__btn--next"), -6, 2) },
      { at: at("DC", T.cookNext2 + 0.25), to: "hold" },
      { at: at("DC", T.ingredients - 0.12), to: centre((p) => p.locator(".cook__btn--mid"), -10, 2) },
      { at: at("DC", T.ingredients + 0.05), to: "hold" },
      { at: at("DC", T.check1 - 0.12), to: layoutCentre(".cook__drawer .check .check__box", 2, 2, 2) },
      { at: at("DC", T.check1 + 0.05), to: "hold" },
      { at: at("DC", T.check2 - 0.12), to: layoutCentre(".cook__drawer .check .check__box", 3, 2, 2) },
      { at: at("DC", SEGMENTS.DC.to), to: "hold" },
    ],
    clicks: ats("DC", CLICKS.DC),
    events: [
      { at: at("DC", T.save) + 1 / 180, run: (ctx) => ctx.settle(() => /Saved/.test(document.querySelector(".feature__save")?.textContent ?? ""), "the save to land") },
      {
        at: at("DC", T.startCooking) + 1 / 180,
        run: (ctx) => ctx.settle(() => !!document.querySelector("dialog.cook[open] .cook__panel.is-on .cook__words"), "Cook Mode to open"),
      },
    ],
    anchors: {
      title: { sel: "#recipe-title" },
      photo: { sel: ".feature__photo .photo" },
      facts: { sel: "dl.facts" },
      actions: { sel: ".feature__actions" },
      save: { sel: ".feature__save" },
      cook: { sel: ".feature__cook" },
      numeral: { sel: "dialog.cook .cook__panel.is-on:not(.is-top) .cook__n" },
      words: { sel: "dialog.cook .cook__panel.is-on:not(.is-top) .cook__words" },
      count: { sel: "dialog.cook .cook__count" },
      next: { sel: "dialog.cook .cook__btn--next" },
      mid: { sel: "dialog.cook .cook__btn--mid" },
      drawer: { sel: "dialog.cook .cook__drawer" },
      check1: { sel: "dialog.cook .cook__drawer .check", nth: 2 },
      check2: { sel: "dialog.cook .cook__drawer .check", nth: 3 },
    },
    async verify(ctx, meta) {
      const s = await ctx.js(() => ({
        step: document.querySelector("dialog.cook .cook__count")?.textContent?.replace(/\s+/g, " ").trim(),
        checked: [...document.querySelectorAll("dialog.cook .cook__drawer .check")].map((b) => b.getAttribute("aria-pressed")),
      }));
      if (!/Step 3 of 6/.test(s.step ?? "")) throw new Error(`DC ended on "${s.step}", expected step 3 of 6`);
      if (s.checked.join() !== "false,false,true,true,false,false") throw new Error(`DC checks: ${s.checked}`);
      if (!meta.network.some((r) => r.method === "POST" && r.served === "mock" && r.auth)) throw new Error("DC: the save was not an authorised, mocked POST");
    },
  },

  /** Reel 34.60–38.40: Cook Mode resumed at STEP 06/06 (seeded progress); FINISH (35.63) wipes to
   *  NICE ONE. with the DONE stamp. */
  C2: {
    path: `/view-recipe/${MARGHERITA._id}?cook=1`,
    signedIn: true,
    init: {
      local: {
        [`cwm.cook.v1.${MARGHERITA._id}`]: JSON.stringify({ t: VCLOCK_EPOCH - 10 * 60 * 1000, v: { step: 5, total: 6, name: MARGHERITA.name } }),
      },
    },
    duration: dur("C2"),
    async prepare(ctx) {
      await ctx.until(() => !!document.querySelector("dialog.cook[open] .cook__panel.is-on .cook__words"), "Cook Mode", 8);
      await ctx.ready("Cook Mode");
      await ctx.preroll(0.6);
      const step = await ctx.js(() => document.querySelector("dialog.cook .cook__count")?.textContent?.replace(/\s+/g, " ").trim());
      if (!/Step 6 of 6/.test(step ?? "")) throw new Error(`C2 opened on "${step}", expected the resumed step 6 of 6`);
    },
    cursor: [
      { at: 0, to: layoutCentre(".cook__drawer .check .check__box", 3, 2, 2) },
      { at: at("C2", 35.0), to: "hold" },
      { at: at("C2", T.finish - 0.12), to: centre((p) => p.locator(".cook__btn--next"), -6, 2) },
      { at: at("C2", T.finish + 0.4), to: "hold" },
      { at: at("C2", 37.2), to: [1250, 760] },
    ],
    clicks: ats("C2", CLICKS.C2),
    anchors: {
      numeral: { sel: "dialog.cook .cook__panel.is-on:not(.is-top) .cook__n" },
      words: { sel: "dialog.cook .cook__panel.is-on:not(.is-top) .cook__words" },
      nice: { sel: "dialog.cook .cook__nice" },
      stamp: { sel: "dialog.cook app-stamp" },
      lede: { sel: "dialog.cook .cook__lede" },
      next: { sel: "dialog.cook .cook__btn--next" },
    },
    async verify(ctx) {
      const s = await ctx.js(() => ({ nice: document.querySelector(".cook__nice")?.textContent?.trim(), lede: document.querySelector(".cook__lede")?.textContent?.trim() }));
      if (!/Nice one\./i.test(s.nice ?? "") || !/is ready\. Enjoy it\./.test(s.lede ?? "")) throw new Error(`C2 finish screen: ${JSON.stringify(s)}`);
    },
  },

  /** Reel 37.40–40.40: Your Collections, signed in: the saved photos uncover from their colour fields. */
  K: {
    path: "/saved-recipes",
    signedIn: true,
    duration: dur("K"),
    async prepare(ctx) {
      // stop as soon as the list is bound: the photos load (and uncover) on the first filmed step
      await ctx.until(() => document.querySelectorAll(".saved__grid img[src*='dummyjson']").length >= 4, "the collection");
      await ctx.poll(() => ctx.js(() => document.fonts.status === "loaded"), "the fonts");
    },
    anchors: {
      title: { sel: "#saved-title" },
      count: { sel: ".saved__count" },
      grid: { sel: ".saved__grid" },
      last: { sel: ".saved__grid > li", nth: 3 },
    },
  },

  /** Reel 39.40–44.77: the end card. The real hero with its intro, everything but the headline and
   *  the platter hidden by injected CSS (header, kicker, lede, CTAs, info block, controls, strip);
   *  Previous is clicked from script at 42.43 so only the yolk edge sweeps behind the lockup. */
  E: {
    path: "/",
    intro: true,
    duration: dur("E"),
    css: `
      .site-header, app-navbar, .skip-link { display: none !important; }
      .hero .kicker, .hero__lede, .hero__cta, .hero__info, .hero__controls { visibility: hidden !important; }
      .hero { min-height: 100vh; }
      /* room above the real headline for the drawn wordmark (the header is gone) */
      .hero__type { padding-top: 116px !important; }
      .cursor-tag { display: none !important; }
    `,
    prepare: introStart,
    events: [{ at: at("E", T.endPrevious), run: clickJs('button[aria-label="Previous recipe"]') }],
    anchors: { title: { sel: "#hero-title" }, dish: { sel: ".dish.is-active" }, disc: { sel: ".hero__disc" } },
    async verify(ctx) {
      const s = await ctx.js(() => document.querySelector(".hero__recipe .visually-hidden")?.textContent?.trim());
      if (s !== "Chicken Alfredo Pasta") throw new Error(`E ended on ${s}, expected Chicken Alfredo Pasta after one Previous`);
    },
  },
};
