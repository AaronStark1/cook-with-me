/**
 * Helpers shared by the shot lists (shots.mjs, shots-vertical.mjs) and the smoke run (smoke.mjs).
 */

/** Centre of a Playwright locator, nudged by (dx, dy): a cursor target resolved when its segment starts. */
export const centre = (locate, dx = 0, dy = 0) => async (ctx) => {
  const b = await ctx.box(locate(ctx.page));
  return [b.cx + dx, b.cy + dy];
};

/** A point inside a locator's box, as fractions of its width and height. */
export const within = (locate, fx, fy) => async (ctx) => {
  const b = await ctx.box(locate(ctx.page));
  return [b.x + b.w * fx, b.y + b.h * fy];
};

/** Clicks an element from page script (no pointer): used where the shot needs the app's action, not a hand. */
export const clickJs = (selector, text) => (ctx) =>
  ctx.js(
    ([s, t]) => {
      const el = [...document.querySelectorAll(s)].find((e) => !t || e.textContent.trim() === t);
      if (!el) throw new Error(`nothing to click: ${s} ${t ?? ""}`);
      el.click();
    },
    [selector, text ?? null],
  );

/** One Assembly Demo item, as the app's engine lays it out (motion/assembly-timeline.ts). */
export const ASM = { ITEM_MS: 8000, HOLD_MS: 1400, HANDOFF_MS: 970, COUNT: 3 };
export const asmTotalMs = (count = ASM.COUNT) => count * (ASM.ITEM_MS + ASM.HOLD_MS) + (count - 1) * ASM.HANDOFF_MS;

/** The scroll driver's geometry: the section's document top, the sticky top and the scroll travel. */
export function asmGeometry(ctx) {
  return ctx.js(() => {
    const asm = document.querySelector("app-assembly-demo section.asm");
    const stage = asm.querySelector(".asm__stage");
    const rect = asm.getBoundingClientRect();
    return {
      docTop: rect.top + window.scrollY,
      top: parseFloat(getComputedStyle(stage).top) || 0,
      travel: rect.height - stage.offsetHeight,
      count: document.querySelectorAll(".asm__scene").length,
    };
  });
}

/** Scroll offset that puts the scroll driver at `ms` on its whole timeline (item 0 runs 0–8,000 ms). */
export function asmScrollFor(geo, ms) {
  const progress = Math.min(1, Math.max(0, ms / asmTotalMs(geo.count)));
  return geo.docTop - geo.top + progress * geo.travel;
}
