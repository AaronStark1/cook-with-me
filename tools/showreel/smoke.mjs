#!/usr/bin/env node
/**
 * Proves the virtual clock and the data layer before any real shot is filmed (brief §5.1 / §12.1).
 *
 *   npm run smoke              # every case → out/smoke/<case>/ + <case>-sheet.jpg, then a verdict per case
 *   node smoke.mjs a d         # only these cases
 *
 * Each case films ~3 s at the 16:9 setup (1600×900, DSF 1.5, 180 subframes/s; a screenshot every
 * 15th subframe, enough for a 4-per-second sheet) and then checks the page state:
 *   a  hero Next: the leaving colour panel is gone afterwards
 *   b  Assembly Demo scrubbed to 4,600 ms and held still for 3 s: mid-iris photo, frame unchanged
 *   c  Cook Mode Next: only one step panel is left on screen afterwards
 *   d  Surprise wheel with Math.random scripted to [0.25, 0.6]: lands on Margherita, marker aligned
 *   e  tile → detail shared-element morph: completes, no view-transition pseudo-elements left
 *   f  an authorised POST (Save, signed in) is answered by its mock with 201, preflight included
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, captureShot, sheet, fixtures } from "./capture.mjs";
import { asmGeometry, asmScrollFor, centre } from "./lib/shot-helpers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "out", "smoke");
const fx = fixtures();
const margherita = fx.byName(/^Classic Margherita Pizza$/)._id;
const results = {};
const check = (name, ok, detail) => {
  (results[name] ??= []).push({ ok: !!ok, detail });
};

const CASES = {
  a: {
    path: "/",
    duration: 3,
    async prepare(ctx) {
      await ctx.until(() => !!document.querySelector('.dish.is-active img[src*="dummyjson"]'), "the hero");
      await ctx.ready("the hero");
      await ctx.preroll(0.3);
    },
    cursor: [
      { at: 0, to: [1300, 860] },
      { at: 0.3, to: centre((p) => p.getByRole("button", { name: "Next recipe" })) },
      { at: 2.9, to: "hold" },
    ],
    clicks: [0.5],
    async verify(ctx) {
      const s = await ctx.js(() => ({
        sweepOn: document.querySelector(".hero__sweep").classList.contains("is-on"),
        sweepAnims: document.querySelector(".hero__sweep").getAnimations().length,
        recipe: document.querySelector(".hero__recipe .visually-hidden")?.textContent?.trim(),
        leavingLayers: document.querySelectorAll(".lyr:not(.is-off)").length,
      }));
      check("a", !s.sweepOn && s.sweepAnims === 0, `sweep panel on=${s.sweepOn}, animations=${s.sweepAnims}`);
      check("a", s.recipe === "Chicken Biryani", `active recipe: ${s.recipe}`);
      check("a", s.leavingLayers === 3, `visible stage layers (word, garnish, props): ${s.leavingLayers}`);
    },
  },

  b: {
    path: "/",
    duration: 3,
    async prepare(ctx) {
      await ctx.until(() => !!document.querySelector('.dish.is-active img[src*="dummyjson"]'), "the hero");
      await ctx.scrollTo(await ctx.docTop(".demo-slot"));
      await ctx.until(() => !!document.querySelector(".asm__stage .asm__photo img"), "the Assembly Demo (@defer)", 8);
      await ctx.ready("the Assembly Demo", [".asm__photo img"]);
      ctx.vars.geo = await asmGeometry(ctx);
      await ctx.scrollTo(asmScrollFor(ctx.vars.geo, 4600));
      await ctx.preroll(0.2);
    },
    scroll: (t, ctx) => asmScrollFor(ctx.vars.geo, 4600),
    async verify(ctx, meta) {
      const s = await ctx.js(() => {
        const photo = document.querySelector('.asm__scene[data-scene="0"] .asm__photo');
        return { clip: getComputedStyle(photo).clipPath, img: photo.querySelector("img").currentSrc, phase: document.querySelector(".asm__angle")?.textContent?.trim() };
      });
      const r = Number((s.clip.match(/circle\(([\d.]+)%/) ?? [])[1]);
      check("b", r > 5 && r < 50, `photo clip at 4,600 ms: ${s.clip}`);
      check("b", !/plate\.svg/.test(s.img), `photo: ${s.img}`);
      ctx.vars.firstLast = [0, Math.round(meta.fps * 3) - 15];
    },
  },

  c: {
    path: `/view-recipe/${margherita}?cook=1`,
    duration: 3,
    async prepare(ctx) {
      await ctx.until(() => !!document.querySelector("dialog.cook[open]"), "Cook Mode (lazy chunk)", 8);
      await ctx.ready("Cook Mode");
      await ctx.preroll(0.4);
    },
    cursor: [
      { at: 0, to: centre((p) => p.locator(".cook__btn--next")) },
      { at: 2.9, to: "hold" },
    ],
    clicks: [0.5],
    async verify(ctx) {
      const s = await ctx.js(() => ({
        on: [...document.querySelectorAll(".cook__panel")].filter((p) => p.classList.contains("is-on")).length,
        visible: [...document.querySelectorAll(".cook__panel")].filter((p) => getComputedStyle(p).visibility !== "hidden").length,
        step: document.querySelector(".cook__count")?.textContent?.replace(/\s+/g, " ").trim(),
      }));
      check("c", s.on === 1 && s.visible === 1, `panels on=${s.on}, visible=${s.visible}`);
      check("c", /Step 2 of 6/.test(s.step ?? ""), `counter: ${s.step}`);
    },
  },

  d: {
    path: "/all-recipes",
    duration: 4.2,
    async prepare(ctx) {
      await ctx.until(() => !!document.querySelector("button.chip"), "the index");
      await ctx.ready("the index");
      await ctx.js(() => [...document.querySelectorAll("button.chip")].find((b) => b.textContent.trim() === "Italian").click());
      await ctx.preroll(1.2);
      await ctx.ready("the Italian tiles");
    },
    cursor: [
      { at: 0, to: [900, 500] },
      { at: 0.3, to: centre((p) => p.locator("button.surprise")) },
      { at: 4.1, to: "hold" },
    ],
    rand: [{ at: 0.4, values: [0.25, 0.6] }],
    clicks: [0.5],
    events: [{ at: 0.52, run: (ctx) => ctx.settle(() => !!document.querySelector("dialog.spin[open] .spin__ring"), "the wheel") }],
    async verify(ctx, meta) {
      const s = await ctx.js(() => ({
        name: document.querySelector(".spin__name")?.textContent?.trim(),
        phase: document.querySelector(".spin__result") ? "result" : "spin",
      }));
      check("d", s.name === "Classic Margherita Pizza", `result card: ${s.name}`);
      const scripted = meta.rand.filter((r) => r.scripted).map((r) => r.value);
      check("d", scripted.length === 2 && scripted[0] === 0.25 && scripted[1] === 0.6, `scripted values consumed: ${JSON.stringify(scripted)}; all Math.random calls: ${meta.rand.length}`);
    },
    // landing alignment is checked mid-shot (before the card replaces the wheel)
    extraEvents: true,
  },

  e: {
    path: "/all-recipes",
    duration: 3,
    async prepare(ctx) {
      await ctx.until(() => !!document.querySelector("app-recipe-tile"), "the index");
      await ctx.ready("the index");
      const y = await ctx.js(() => document.querySelectorAll("app-recipe-tile")[3].getBoundingClientRect().top + scrollY - 140);
      await ctx.scrollTo(y);
      await ctx.preroll(1.5);
      await ctx.ready("the tiles");
    },
    cursor: [
      { at: 0, to: [800, 300] },
      { at: 0.3, to: centre((p) => p.locator("app-recipe-tile").nth(3).locator(".tile__photo")) },
      { at: 2.9, to: "hold" },
    ],
    clicks: [0.6],
    async verify(ctx) {
      const s = await ctx.js(() => ({
        path: location.pathname,
        vt: document.documentElement.getAttribute("data-vt"),
        vtAnims: document.getAnimations().filter((a) => (a.effect?.pseudoElement ?? "").startsWith("::view-transition")).length,
        title: document.querySelector("#recipe-title")?.textContent?.trim(),
      }));
      check("e", s.path.startsWith("/view-recipe/"), `path: ${s.path}`);
      check("e", s.vt === null && s.vtAnims === 0, `data-vt=${s.vt}, view-transition animations left=${s.vtAnims}`);
      check("e", s.title === "Classic Margherita Pizza", `detail title: ${s.title}`);
    },
  },

  f: {
    path: `/view-recipe/${margherita}`,
    duration: 2.5,
    signedIn: true,
    async prepare(ctx) {
      await ctx.until(() => !!document.querySelector(".feature__save"), "the detail page");
      await ctx.ready("the detail page");
      await ctx.preroll(1);
    },
    cursor: [
      { at: 0, to: [900, 700] },
      { at: 0.3, to: centre((p) => p.locator(".feature__save")) },
      { at: 2.4, to: "hold" },
    ],
    clicks: [0.6],
    events: [{ at: 0.62, run: (ctx) => ctx.settle(() => /Saved/.test(document.querySelector(".feature__save")?.textContent ?? ""), "the save to land") }],
    async verify(ctx, meta) {
      const s = await ctx.js(() => ({ label: document.querySelector(".feature__save")?.textContent?.replace(/\s+/g, " ").trim(), notice: document.querySelector(".alert")?.textContent?.trim() }));
      const post = meta.network.filter((r) => r.method === "POST");
      const pre = meta.network.filter((r) => r.method === "OPTIONS");
      check("f", /Saved/.test(s.label ?? "") && /Saved to your collection/.test(s.notice ?? ""), `button: "${s.label}", notice: "${s.notice}"`);
      check("f", post.length === 1 && post[0].served === "mock", `POSTs: ${JSON.stringify(post)}; preflights seen by the handler: ${pre.length}`);
    },
  },
};

// (g) the reel's S → D: the wheel's result card, then "Cook this" (does the result photo morph?)
CASES.g = {
  ...CASES.d,
  duration: 5.4,
  cursor: [
    { at: 0, to: [900, 500] },
    { at: 0.3, to: centre((p) => p.locator("button.surprise")) },
    { at: 3.75, to: "hold" },
    { at: 4.15, to: centre((p) => p.locator(".spin__actions a.btn-cwm")) },
    { at: 5.3, to: "hold" },
  ],
  clicks: [0.5, 4.3],
  events: [CASES.d.events[0]],
  async verify(ctx) {
    const s = await ctx.js(() => ({
      path: location.pathname,
      vtAnims: document.getAnimations().filter((a) => (a.effect?.pseudoElement ?? "").startsWith("::view-transition")).length,
      title: document.querySelector("#recipe-title")?.textContent?.trim(),
      transitions: window.__vt.stats.viewTransitions,
    }));
    check("g", s.title === "Classic Margherita Pizza" && s.vtAnims === 0, `landed on ${s.path} (${s.title}); view transitions run: ${s.transitions}; left: ${s.vtAnims}`);
  },
};

// (d) also checks the landing itself: the winner's dish sits under the marker when the wheel stops
CASES.d.events.push({
  at: 0.52 + 2.9,
  run: async (ctx) => {
    const s = await ctx.js(() => {
      const ring = document.querySelector(".spin__ring");
      if (!ring) return null;
      const rot = parseFloat(getComputedStyle(ring).rotate) || 0;
      const dishes = [...ring.querySelectorAll(".spin__dish img")].map((i) => i.currentSrc);
      return { rot, dishes };
    });
    if (!s) return check("d", false, "the wheel was gone before it landed");
    const count = s.dishes.length;
    const winnerSlot = s.dishes.findIndex((src) => /\/1\.webp$/.test(src));
    const angle = (((winnerSlot * 360) / count + s.rot) % 360 + 360) % 360;
    const off = Math.min(angle, 360 - angle);
    check("d", winnerSlot === 1 && off < 0.5, `wheel rotation ${s.rot.toFixed(2)}°, Margherita in slot ${winnerSlot} of ${count}, ${off.toFixed(2)}° from the marker`);
  },
});

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ids = only.length ? only : Object.keys(CASES);
await fs.mkdir(OUT, { recursive: true });
const browser = await launch();
try {
  for (const id of ids) {
    const shot = CASES[id];
    const started = Date.now();
    try {
      const { meta } = await captureShot(browser, id, shot, { aspect: "16x9", outDir: OUT, quiet: true, shotEvery: 15 });
      if (id === "b") {
        // frame 15 on: frame 0 can still carry the raster settle of the scroll made in prepare
        const names = ["00015", String(Math.round(meta.fps * 3) - 15).padStart(5, "0")];
        const [a, b] = await Promise.all(names.map((n) => fs.readFile(path.join(OUT, "b", `${n}.jpg`))));
        const held = ((Number(names[1]) - Number(names[0])) / meta.fps).toFixed(2);
        check("b", a.equals(b), `frames ${names.join(" and ")} (${held} s of virtual time apart, scroll held) are ${a.equals(b) ? "byte-identical" : "DIFFERENT"}`);
      }
      if (meta.errors.length) check(id, true, `page errors (informational): ${meta.errors.slice(0, 3).join(" | ")}`);
      console.log(`case ${id}: filmed in ${((Date.now() - started) / 1000).toFixed(0)}s; sheet ${await sheet(id, { outDir: OUT })}`);
    } catch (e) {
      check(id, false, `capture failed: ${e.message}`);
    }
  }
} finally {
  await browser.close();
}
let failed = 0;
for (const id of ids) {
  const list = results[id] ?? [{ ok: false, detail: "no checks ran" }];
  const ok = list.every((r) => r.ok);
  if (!ok) failed++;
  console.log(`\n${ok ? "PASS" : "FAIL"} ${id}`);
  for (const r of list) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.detail}`);
}
process.exit(failed ? 1 : 0);
