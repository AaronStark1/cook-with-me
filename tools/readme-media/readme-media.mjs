#!/usr/bin/env node
/**
 * Films the running Cook With Me app and cuts the README media into ../../docs/readme/.
 *
 *   # with the API on :3000 and `npm start` on :4200
 *   cd tools/readme-media && npm install
 *   node readme-media.mjs                  # everything
 *   node readme-media.mjs hero browse      # only these items
 *   node readme-media.mjs --sheets cook    # also write a contact sheet per shot to out/
 *
 * How it works: every shot runs in its own browser context with lib/vclock.js installed, so the
 * page only moves when this script steps virtual time. Each step is one frame: run any scripted
 * input due, move the drawn cursor, advance the clock (timers, rAF, CSS/WAAPI animations and view
 * transitions all follow it), then screenshot. The frames become animated WebP — GitHub renders
 * images from a repository but plays no MP4 inline — with a caption bar set in the app's own
 * display face. The title card and brand sheet are rendered from HTML with the app's fonts.
 *
 * Data: recipes come from your running API, and recipe photos are cached to out/cache so re-runs
 * are offline and repeatable. Signed-in screens use a fake session in sessionStorage plus mocked
 * responses for the signed-in endpoints, and every write request (POST/PUT/PATCH/DELETE) is
 * answered here — filming never writes to your database.
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import ffmpegPath from "ffmpeg-static";
import { VCLOCK_SCRIPT, CURSOR_SCRIPT } from "./lib/vclock.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const OUT = path.join(root, "docs", "readme");
const WORK = path.join(here, "out");
const CACHE = path.join(WORK, "cache");
const FONTS = path.join(root, "frontend", "node_modules");
const BASE = process.env.APP_URL ?? "http://localhost:4200";
const API = process.env.API_URL ?? "http://localhost:3000";
const VIEW = { width: 1440, height: 900 };
const FPS = 20;
const STEP_MS = 1000 / FPS;
const ORIGIN = "http://readme.local";

const C = { paper: "#C8281C", surface: "#A51F15", yolk: "#FFC93C", broth: "#1C0F0A", ink: "#FFF3E0", muted: "#FFE6DA", inkSoft: "#5E4B43" };

// ---------------------------------------------------------------- data

let RECIPES = [];
async function loadRecipes() {
  const res = await fetch(`${API}/api/allRecipes`);
  if (!res.ok) throw new Error(`GET ${API}/api/allRecipes → ${res.status}. Start the backend first.`);
  RECIPES = (await res.json()).response;
  if (!RECIPES?.length) throw new Error("The API returned no recipes; the README media needs a seeded database.");
}
const byName = (re) => RECIPES.find((r) => re.test(r.name)) ?? RECIPES[0];

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const FAKE_TOKEN = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ id: "readme-demo", exp: 4102444800 })}.readme`;
const SESSIONS = {
  user: { _id: "readme-demo", username: "Mira", email: "mira@example.com", role: "User" },
  admin: { _id: "readme-admin", username: "Sam", email: "sam@example.com", role: "Admin" },
};

/** Sample data for the signed-in and admin screens (the README labels these as sample data). */
function mockFor(url, method) {
  const p = new URL(url).pathname;
  if (method !== "GET") return { status: method === "POST" ? 201 : 200, body: { message: "ok (readme capture)" } };
  const saved = [/Margherita/, /Ramen/, /Tiramisu/, /Bibimbap/, /Butter Chicken/, /Falafel/].map(byName)
    .map((r) => ({ _id: `s-${r._id}`, recipeId: r._id, name: r.name, image: r.image, userId: "readme-demo" }));
  switch (p) {
    case "/api/getSavedRecipes": return { body: saved };
    case "/api/getDownload": return { body: [] };
    case "/api/getAllUsers":
      return { body: ["Mira", "Sam", "Ade", "Lena", "Kofi", "Priya", "Tomás", "Yuki", "Noor", "Elif", "Jonah", "Ines"]
        .map((n, i) => ({ _id: `u${i}`, username: n, email: `${n.toLowerCase().replace("á", "a")}@example.com`, role: i === 1 ? "Admin" : "User" })) };
    case "/api/getDownloadedRecipesList":
      return { body: { downloads: [[/Biryani/, 42], [/Margherita/, 37], [/Butter Chicken/, 29], [/Ramen/, 21], [/Tiramisu/, 18], [/Falafel/, 12]]
        .map(([re, count]) => { const r = byName(re); return { _id: `d-${r._id}`, recipeId: r._id, name: r.name, image: r.image, cuisine: r.cuisine, count }; }) } };
    case "/api/getTestimony":
      return { body: { allTestimony: [
        { _id: "t1", username: "Lena", email: "lena@example.com", profession: "Nurse", message: "Cook Mode kept my place through a whole night shift dinner.", status: "Pending" },
        { _id: "t2", username: "Kofi", email: "kofi@example.com", profession: "Student", message: "The surprise wheel picks dinner better than I do.", status: "Pending" },
        { _id: "t3", username: "Priya", email: "priya@example.com", profession: "Designer", message: "Finally a recipe site that looks like a cookbook.", status: "Approved" },
      ] } };
    default: return null;
  }
}

/** Recipe photos come from a CDN; serve them from a disk cache so every run sees the same bytes. */
async function cachedAsset(url) {
  const file = path.join(CACHE, createHash("sha1").update(url).digest("hex"));
  if (existsSync(file)) return { body: await fs.readFile(file), type: (await fs.readFile(file + ".type", "utf8").catch(() => "image/webp")) };
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") ?? "application/octet-stream";
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(file, body);
  await fs.writeFile(file + ".type", type);
  return { body, type };
}

// ---------------------------------------------------------------- tools

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited with ${code}`))));
  });
}
const ffmpeg = (args) => run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

let browser;
async function launch() {
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
}

// ---------------------------------------------------------------- filming

async function newContext({ session, dsf = 1, viewport = VIEW } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dsf, reducedMotion: "no-preference", colorScheme: "light" });
  await context.addInitScript(VCLOCK_SCRIPT);
  await context.addInitScript(CURSOR_SCRIPT);
  if (session) {
    const user = SESSIONS[session];
    await context.addInitScript(([token, u]) => {
      sessionStorage.setItem("token", token);
      sessionStorage.setItem("userDetails", u);
    }, [FAKE_TOKEN, JSON.stringify(user)]);
  }
  await context.route(/^https:\/\/cdn\.dummyjson\.com\//, async (route) => {
    const { body, type } = await cachedAsset(route.request().url());
    return route.fulfill({ body, contentType: type, headers: { "cache-control": "max-age=31536000" } });
  });
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    const mock = session || req.method() !== "GET" ? mockFor(req.url(), req.method()) : null;
    if (!mock) return route.continue();
    return route.fulfill({ status: mock.status ?? 200, contentType: "application/json", body: JSON.stringify(mock.body) });
  });
  return context;
}

function makeCtx(page) {
  const cur = { x: VIEW.width * 0.72, y: VIEW.height + 60, tween: null };
  const queue = []; // { at, fn } scheduled relative to the shot clock
  let scroll = null;
  const ctx = {
    page,
    t: 0,
    /** Steps virtual time without filming (used while preparing a shot). */
    async advance(seconds) {
      const n = Math.round((seconds * 1000) / 50);
      // a little real time per step lets IntersectionObserver (reveals, @defer) deliver its callbacks
      for (let i = 0; i < n; i++) {
        await page.evaluate(() => window.__vt.step(50));
        await page.waitForTimeout(12);
      }
    },
    async box(target) {
      const loc = typeof target === "string" ? page.locator(target).first() : target;
      const b = await loc.boundingBox();
      if (!b) throw new Error(`no box for ${target}`);
      return b;
    },
    /** Glides the cursor to the centre of a target (or {x, y}) over dur seconds. */
    async glide(target, dur = 0.6, dx = 0, dy = 0) {
      const to = target.x !== undefined && !target.locator ? target : await ctx.box(target).then((b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 }));
      cur.tween = { from: { x: cur.x, y: cur.y }, to: { x: to.x + dx, y: to.y + dy }, start: ctx.t, dur };
    },
    async click() {
      await page.mouse.move(cur.x, cur.y);
      await page.mouse.down();
      await page.mouse.up();
    },
    type(text, every = 0.075) {
      [...text].forEach((ch, i) => queue.push({ at: ctx.t + i * every, fn: () => page.keyboard.type(ch) }));
    },
    key: (k) => page.keyboard.press(k),
    scrollTo(y, dur) {
      scroll = { from: null, to: y, start: ctx.t, dur };
    },
    async moveCursor() {
      if (cur.tween) {
        const k = Math.min(1, (ctx.t - cur.tween.start) / cur.tween.dur);
        const e = ease(k);
        // a slight arc reads as a hand, not a robot
        const arc = Math.sin(Math.PI * e) * Math.min(40, Math.hypot(cur.tween.to.x - cur.tween.from.x, cur.tween.to.y - cur.tween.from.y) * 0.08);
        cur.x = lerp(cur.tween.from.x, cur.tween.to.x, e);
        cur.y = lerp(cur.tween.from.y, cur.tween.to.y, e) - arc;
        if (k >= 1) cur.tween = null;
        await page.mouse.move(cur.x, cur.y);
      }
    },
    async applyScroll() {
      if (!scroll) return null;
      if (scroll.from === null) scroll.from = await page.evaluate(() => scrollY);
      const k = Math.min(1, (ctx.t - scroll.start) / scroll.dur);
      const y = lerp(scroll.from, scroll.to, ease(k));
      if (k >= 1) scroll = null;
      return y;
    },
    async runQueue() {
      for (let i = 0; i < queue.length; ) {
        if (queue[i].at <= ctx.t + 1e-6) {
          const [{ fn }] = queue.splice(i, 1);
          await fn();
        } else i++;
      }
    },
  };
  return ctx;
}

async function open(context, shot) {
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(`  [${shot.id}] page error:`, e.message));
  await page.goto(BASE + shot.path, { waitUntil: "domcontentloaded" });
  const ctx = makeCtx(page);
  // boot: Angular schedules through the (virtual) timers, so step until the API data has landed
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => window.__vt.step(50));
    await page.waitForTimeout(25);
  }
  await page.waitForLoadState("networkidle");
  return { page, ctx };
}

async function film(shot) {
  const dir = path.join(WORK, "shots", shot.id);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const context = await newContext({ session: shot.session, viewport: shot.viewport });
  const { page, ctx } = await open(context, shot);
  await shot.prepare?.(ctx);
  const events = [...(shot.timeline ?? [])].map(([at, fn]) => ({ at, fn, done: false }));
  const total = Math.round(shot.duration * FPS);
  const started = Date.now();
  for (let i = 0; i < total; i++) {
    ctx.t = i / FPS;
    for (const e of events) if (!e.done && ctx.t >= e.at - 1e-6) { e.done = true; await e.fn(ctx); }
    await ctx.runQueue();
    await ctx.moveCursor();
    const y = await ctx.applyScroll();
    await page.evaluate(([top, ms]) => {
      if (top !== null) window.scrollTo({ top, behavior: "instant" });
      return window.__vt.step(ms);
    }, [y, i === 0 ? 0 : STEP_MS]);
    await page.evaluate(() => { if (document.querySelector("dialog[open]")) window.__cursor.raise(); });
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 90 });
  }
  await context.close();
  console.log(`  [${shot.id}] ${total} frames in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  return dir;
}

async function still(item) {
  const context = await newContext({ session: item.session });
  const { page, ctx } = await open(context, item);
  await page.evaluate(() => window.__cursor.hide(true));
  await item.prepare?.(ctx);
  await ctx.advance(item.settle ?? 2.5);
  const png = path.join(WORK, `${item.id}.png`);
  await page.screenshot({ path: png });
  await context.close();
  await ffmpeg(["-i", png, "-vf", "scale=1200:-1:flags=lanczos", "-c:v", "libwebp", "-quality", "82", "-compression_level", "6", path.join(OUT, `${item.id}.webp`)]);
}

async function sheet(id) {
  const dir = path.join(WORK, "shots", id);
  await ffmpeg(["-framerate", String(FPS), "-i", path.join(dir, "%05d.jpg"), "-vf", `fps=2,scale=360:-1,tile=6x4:padding=4:margin=4:color=0x1C0F0A`, "-frames:v", "1", path.join(WORK, `${id}-sheet.jpg`)]);
}

// ---------------------------------------------------------------- the shots

const chip = (name) => `button.chip:has-text("${name}")`;

/**
 * The capture window of a clip is [from, to] seconds of its shot; hold = seconds the last frame stays up;
 * crop = [x, y, w, h] in CSS px of the viewport.
 */
const CLIPS = {
  hero: {
    path: "/", duration: 11.2,
    prepare: async (ctx) => ctx.advance(0.2),
    clip: { from: 0.6, to: 11.0, width: 1200, fps: 15, quality: 70 },
  },
  browse: {
    path: "/all-recipes", duration: 7.4, viewport: { width: 1440, height: 1120 },
    prepare: async (ctx) => {
      await ctx.advance(1.6);
      await ctx.page.evaluate(() => window.scrollTo({ top: 360, behavior: "instant" }));
      await ctx.advance(2.2);
    },
    timeline: [
      [0.3, (c) => c.glide('input[type="search"], .index-search input', 0.7, -150)],
      [1.05, (c) => c.click()],
      [1.25, (c) => c.type("chicken", 0.09)],
      [3.0, (c) => c.glide(chip("Pakistani"), 0.7)],
      [3.75, (c) => c.click()],
      [5.6, (c) => c.glide({ x: 1180, y: 980 }, 0.8)],
    ],
    clip: { from: 0.2, to: 7.2, hold: 0.8, width: 1200, fps: 20, caption: ["01", "Search and filter the index", "Type to search · filter by cuisine and meal"] },
  },
  recipe: {
    path: "/all-recipes", duration: 5.4,
    prepare: async (ctx) => {
      await ctx.advance(1.6);
      const b = await ctx.box("app-recipe-tile");
      await ctx.page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), b.y - 120);
      await ctx.advance(2.5);
    },
    timeline: [
      [0.2, (c) => c.glide(c.page.locator("app-recipe-tile").nth(3), 0.8)],
      [1.2, (c) => c.click()],
      [3.4, (c) => c.glide(".feature__cook", 0.8)],
    ],
    clip: { from: 0.1, to: 5.3, hold: 0.8, width: 1200, fps: 20, caption: ["02", "Open a recipe", "The photo travels from the tile to the page"] },
  },
  cook: {
    path: `/view-recipe/{margherita}`, duration: 9.0,
    prepare: async (ctx) => ctx.advance(3),
    timeline: [
      [0.2, (c) => c.glide(".feature__cook", 0.7)],
      [0.95, (c) => c.click()],
      [2.4, (c) => c.glide(".cook__btn--next", 0.6)],
      [3.05, (c) => c.click()],
      [4.4, (c) => c.click()],
      [5.6, (c) => c.glide(".cook__btn--mid", 0.6)],
      [6.25, (c) => c.click()],
      [7.0, (c) => c.glide(c.page.locator(".cook__drawer .check").nth(0), 0.45)],
      [7.5, (c) => c.click()],
      [7.75, (c) => c.glide(c.page.locator(".cook__drawer .check").nth(1), 0.35)],
      [8.15, (c) => c.click()],
    ],
    clip: { from: 0.1, to: 8.9, hold: 1.0, width: 1200, fps: 20, caption: ["03", "Cook it, step by step", "Cook Mode · check off ingredients · resumes where you left off"] },
  },
  surprise: {
    path: "/all-recipes", duration: 8.0,
    prepare: async (ctx) => ctx.advance(3),
    timeline: [
      [0.2, (c) => c.glide("button.surprise", 0.7)],
      [0.95, (c) => c.click()],
    ],
    clip: { from: 0.1, to: 7.9, hold: 1.0, width: 940, crop: [250, 100, 940, 700], fps: 20, caption: ["04", "Can't decide? Spin the platter", "Surprise me picks from the recipes on screen"] },
  },
  assembly: {
    path: "/", duration: 7.6,
    prepare: async (ctx) => {
      await ctx.advance(1);
      const top = await ctx.page.evaluate(() => document.querySelector(".demo-slot").getBoundingClientRect().top + scrollY - 68);
      await ctx.page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);
      await ctx.advance(1.2);
      ctx.demoTop = top;
    },
    // the first recipe of the scroll-driven demo, from an empty plate to the finished dish
    timeline: [[0.3, (c) => c.scrollTo(c.demoTop + 930, 6.2)]],
    clip: { from: 0.0, to: 7.5, hold: 1.4, width: 1200, fps: 20, quality: 66, caption: ["05", "Watch a dish come together", "The Assembly Demo builds a recipe from its real ingredients"] },
  },
};

const SCREENS = {
  "screen-home": { path: "/", settle: 3 },
  "screen-recipes": {
    path: "/all-recipes",
    prepare: async (ctx) => { await ctx.advance(1.5); await ctx.page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" })); },
  },
  "screen-recipe": { path: "/view-recipe/{ramen}", settle: 3 },
  "screen-cook": {
    path: "/view-recipe/{ramen}",
    prepare: async (ctx) => { await ctx.advance(2); await ctx.page.click(".feature__cook"); await ctx.advance(1.5); await ctx.page.click(".cook__btn--next"); },
  },
  "screen-collection": { path: "/saved-recipes", session: "user", settle: 3.5 },
  "screen-admin": { path: "/admin", session: "admin", settle: 3.5 },
};

// ---------------------------------------------------------------- composition

async function htmlPage(dsf = 1) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: dsf });
  await page.route(`${ORIGIN}/**`, async (route) => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname);
    if (p.startsWith("/fonts/")) return route.fulfill({ body: await fs.readFile(path.join(FONTS, p.slice(7))), contentType: "font/woff2" });
    return route.fulfill({ body: "<!doctype html><html><head><meta charset=utf-8></head><body></body></html>", contentType: "text/html" });
  });
  await page.route(/^https:\/\/cdn\.dummyjson\.com\//, async (route) => {
    const { body, type } = await cachedAsset(route.request().url());
    return route.fulfill({ body, contentType: type });
  });
  await page.goto(ORIGIN + "/");
  return page;
}

const BASE_CSS = `
@font-face { font-family: "Dela Gothic One"; src: url("/fonts/@fontsource/dela-gothic-one/files/dela-gothic-one-latin-400-normal.woff2") format("woff2"); }
@font-face { font-family: "Archivo"; font-weight: 100 900; src: url("/fonts/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2") format("woff2-variations"); }
* { box-sizing: border-box; margin: 0; }
html, body { background: transparent; }
.d { font-family: "Dela Gothic One", sans-serif; text-transform: uppercase; line-height: .92; }
.l { font-family: "Archivo", sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; }
`;

async function renderHtml(page, html, css, selector, file, { omitBackground = false } = {}) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><base href="${ORIGIN}/"><style>${BASE_CSS}${css}</style></head><body>${html}</body></html>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.locator(selector).screenshot({ path: file, omitBackground });
}

async function captionPng(page, [num, title, sub], width, file) {
  const css = `
  .cap { width: ${width}px; height: 78px; display: flex; align-items: stretch; background: ${C.broth}; border-top: 4px solid ${C.yolk}; }
  .n { width: 78px; display: grid; place-items: center; background: ${C.yolk}; color: ${C.broth}; font-size: 30px; }
  .txt { display: flex; flex-direction: column; justify-content: center; gap: 7px; padding: 0 26px; }
  .t { color: ${C.ink}; font-size: 25px; }
  .s { color: ${C.muted}; font-size: 12.5px; opacity: .85; }
  .mark { margin-left: auto; display: flex; align-items: center; padding-right: 24px; gap: 0; font-size: 17px; }
  .mark b { color: ${C.ink}; font-weight: 400; } .mark span { background: ${C.yolk}; color: ${C.broth}; padding: 3px 6px 2px; margin-left: 5px; }`;
  const html = `<div class="cap"><div class="n d">${num}</div><div class="txt"><div class="t d">${title}</div><div class="s l">${sub}</div></div><div class="mark d"><b>Cook</b><span>With Me</span></div></div>`;
  await renderHtml(page, html, css, ".cap", file);
}

async function titleCard(page) {
  const dishes = [/Tiramisu/, /Margherita/, /Ramen/, /Biryani/, /Bibimbap/].map(byName);
  const css = `
  .card { position: relative; width: 1600px; height: 660px; overflow: hidden; background: ${C.paper}; color: ${C.ink}; border-bottom: 10px solid ${C.yolk}; }
  .copy { position: absolute; left: 72px; top: 70px; width: 860px; }
  .k { display: flex; align-items: center; gap: 18px; font-size: 17px; }
  .k::before { content: ""; width: 54px; height: 3px; background: ${C.ink}; }
  .mark { margin-top: 30px; font-size: 112px; white-space: nowrap; }
  .mark span { display: inline-block; background: ${C.yolk}; color: ${C.broth}; padding: 8px 18px 0; margin-top: 6px; }
  .tag { margin-top: 28px; font-family: Archivo; font-size: 30px; font-weight: 500; line-height: 1.3; max-width: 720px; }
  .chips { margin-top: 30px; display: flex; gap: 12px; }
  .chips div { border: 2px solid ${C.ink}; padding: 10px 14px 9px; font-size: 14px; }
  .chips div.y { background: ${C.yolk}; border-color: ${C.broth}; color: ${C.broth}; }
  .platter { position: absolute; left: 930px; top: 40px; width: 900px; height: 900px; border-radius: 50%; background: ${C.broth}; }
  .orbit { position: absolute; left: 990px; top: 100px; width: 780px; height: 780px; border-radius: 50%; border: 4px dashed ${C.yolk}; }
  .dish { position: absolute; border-radius: 50%; overflow: hidden; border: 10px solid ${C.ink}; }
  .dish img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .egg { position: absolute; right: 44px; top: 36px; width: 74px; height: 74px; }`;
  const spots = [[1100, 150, 330], [1000, 440, 210], [1395, 405, 250], [1330, 70, 150], [1470, 220, 140]];
  const html = `<div class="card">
    <div class="copy">
      <div class="k l">Recipes to discover, save &amp; cook</div>
      <div class="mark d">Cook<br><span>With Me</span></div>
      <div class="tag">Good food, your way. Browse the recipes, save the ones you love and cook them step by step.</div>
      <div class="chips l"><div class="y">Angular 20</div><div>Express 5</div><div>MongoDB</div><div>No animation library</div></div>
    </div>
    <div class="platter"></div><div class="orbit"></div>
    ${dishes.map((d, i) => { const [x, y, s] = spots[i]; return `<div class="dish" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px"><img src="${d.image}" alt=""></div>`; }).join("")}
  </div>`;
  await renderHtml(page, html, css, ".card", path.join(OUT, "title.png"));
}

async function brandSheet(page) {
  const sw = [["--paper", "Tomato", C.paper, C.ink], ["--surface", "Deep red", C.surface, C.ink], ["--yolk", "Yolk", C.yolk, C.broth], ["--broth", "Broth", C.broth, C.ink], ["--ink", "Cream", C.ink, C.broth]];
  const css = `
  .b { width: 1600px; background: ${C.broth}; color: ${C.ink}; padding: 56px 64px 60px; border-top: 10px solid ${C.yolk}; }
  .row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; border: 3px solid ${C.ink}; }
  .s { height: 210px; padding: 22px; display: flex; flex-direction: column; justify-content: space-between; border-right: 3px solid ${C.ink}; }
  .s:last-child { border-right: 0; }
  .s .n { font-size: 30px; } .s .h { font-size: 13px; }
  .type { display: grid; grid-template-columns: 1.15fr 1fr; gap: 48px; margin-top: 48px; align-items: end; }
  .big { font-size: 112px; text-transform: none; display: flex; gap: 18px; align-items: flex-end; } .big span { background: ${C.yolk}; color: ${C.broth}; padding: 4px 14px 0; }
  .meta { font-size: 13px; color: ${C.muted}; margin-top: 18px; }
  .body { font-family: Archivo; font-size: 27px; line-height: 1.45; font-weight: 450; }
  .body b { font-weight: 800; }`;
  const html = `<div class="b">
    <div class="row">${sw.map(([t, n, bg, fg]) => `<div class="s" style="background:${bg};color:${fg}"><div class="n d">${n}</div><div class="h l">${t}<br>${bg}</div></div>`).join("")}</div>
    <div class="type">
      <div><div class="big d">Aa<span>Gg</span></div><div class="meta l">Dela Gothic One · display</div></div>
      <div><div class="body">Flat colour, hard edges, cream on red and broth on yolk. <b>Archivo</b> carries the reading text, from labels to method steps.</div><div class="meta l">Archivo Variable · text</div></div>
    </div>
  </div>`;
  await renderHtml(page, html, css, ".b", path.join(OUT, "brand.png"));
}

async function encodeClip(id, spec, caps) {
  const dir = path.join(WORK, "shots", id);
  const { from = 0, to, hold = 0, width, fps, quality = 72, caption, crop } = spec;
  const cropF = crop ? `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]},` : "";
  const filters = [`[0:v]trim=start=${from}:end=${to},setpts=PTS-STARTPTS,fps=${fps},${cropF}scale=${width}:-2:flags=lanczos${hold ? `,tpad=stop_mode=clone:stop_duration=${hold}` : ""}[v]`];
  const inputs = ["-framerate", String(FPS), "-i", path.join(dir, "%05d.jpg")];
  let last = "[v]";
  if (caption) {
    const png = path.join(WORK, `${id}-caption.png`);
    await captionPng(caps, caption, width, png);
    inputs.push("-loop", "1", "-i", png);
    filters.push(`[v][1:v]vstack=inputs=2:shortest=1[o]`);
    last = "[o]";
  }
  const file = path.join(OUT, `${id}.webp`);
  await ffmpeg([...inputs, "-filter_complex", filters.join(";"), "-map", last, "-c:v", "libwebp_anim", "-loop", "0", "-quality", String(quality), "-compression_level", "6", "-preset", "picture", file]);
  const { size } = await fs.stat(file);
  console.log(`  → docs/readme/${id}.webp ${(size / 1024 / 1024).toFixed(2)} MB`);
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2);
const wantSheets = args.includes("--sheets");
const only = args.filter((a) => !a.startsWith("--"));
const ALL = [...Object.keys(CLIPS), "screens", "title", "brand"];
const want = only.length ? only : ALL;
for (const w of want) if (!ALL.includes(w) && !SCREENS[w]) throw new Error(`unknown item ${w}; choose from ${ALL.join(", ")}, ${Object.keys(SCREENS).join(", ")}`);

await loadRecipes();
const ids = { margherita: byName(/Margherita/)._id, ramen: byName(/Ramen/)._id };
const fill = (p) => p.replace(/\{(\w+)\}/g, (_, k) => ids[k]);
await fs.mkdir(OUT, { recursive: true });
await launch();
try {
  const caps = await htmlPage(1);
  for (const id of want.filter((w) => CLIPS[w])) {
    console.log(`clip ${id}`);
    const shot = { id, ...CLIPS[id], path: fill(CLIPS[id].path) };
    await film(shot);
    if (wantSheets) await sheet(id);
    await encodeClip(id, shot.clip, caps);
  }
  const screenIds = want.includes("screens") ? Object.keys(SCREENS) : want.filter((w) => SCREENS[w]);
  for (const id of screenIds) {
    console.log(`screen ${id}`);
    await still({ id, ...SCREENS[id], path: fill(SCREENS[id].path) });
  }
  if (want.includes("title")) { console.log("title"); await titleCard(await htmlPage(1)); }
  if (want.includes("brand")) { console.log("brand"); await brandSheet(await htmlPage(1)); }
} finally {
  await browser.close();
}
