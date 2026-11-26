#!/usr/bin/env node
/**
 * Films the reel's shots from the running Cook With Me app, frame by frame, under virtual time.
 *
 *   node capture.mjs                         # every 16:9 shot (shots.mjs) → out/shots/16x9/<id>/
 *   node capture.mjs H A --sheet             # only these shots, plus a contact sheet each (1 frame / 0.25 s)
 *   node capture.mjs --aspect 9x16           # the vertical cut's shots (shots-vertical.mjs)
 *   node capture.mjs --workers 2             # shots filmed in parallel (default 3)
 *   DATA=live node capture.mjs I             # let GETs reach the API on :3000 (a look at current data)
 *
 * Needs the app on :4200 (`cd frontend && npm start`). The API on :3000 is NOT needed: every API
 * response is served from fixtures/ (record them once with `npm run fixtures`) and every recipe
 * photo from out/cache/images/. Nothing is ever written to the API: a write the shot has no mock
 * for throws, and the request log of each shot is kept in its meta.json.
 *
 * Each shot runs in its own browser context with lib/vclock.js installed, so the page only moves
 * when a frame is taken: 16:9 films 180 subframes a second (3 per 60 fps frame, averaged into
 * motion blur by the compositor), 9:16 films 90 (3 per 30 fps frame). Pointer moves, presses,
 * drags, scrolls and scripted randomness are applied per subframe from the shot list; the pointer
 * path and the anchors' rects are written to meta.json for the compositor's cursor and camera.
 */
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import ffmpegPath from "ffmpeg-static";
import { VCLOCK_SCRIPT } from "./lib/vclock.js";
import { imageCacheFile, DEMO_USER_ID } from "./fixtures.mjs";
import { fixtures } from "./lib/data.mjs";
export { fixtures };

const here = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.join(here, "out", "shots");
export const BASE = process.env.APP_URL ?? "http://localhost:4200";
export const API = "http://localhost:3000";
const IMAGE_HOST = "cdn.dummyjson.com";
const LIVE = process.env.DATA === "live";

/** Per-aspect filming setup. Segment offsets in timeline.mjs are multiples of 1/90 s, so both rates work. */
export const ASPECTS = {
  "16x9": { viewport: { width: 1600, height: 900 }, dsf: 1.5, subFps: 180, touch: false },
  "9x16": { viewport: { width: 432, height: 768 }, dsf: 3, subFps: 90, touch: true },
};
import { PRESS_S } from "./timeline.mjs";
export { PRESS_S };

/** The browser, pinned: Playwright's own Chromium build for playwright-core 1.64.1 (r1248, Chrome for Testing 156). */
export const BROWSER = { channel: "chromium", revision: "1248" };
export const BROWSER_ARGS = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--force-color-profile=srgb", "--hide-scrollbars"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp01 = (u) => Math.min(1, Math.max(0, u));
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
/** A drag eases out so it lets go slowly (the hero adds a step for a release faster than 0.5 px/ms). */
const dragEase = (u) => 1 - Math.pow(1 - u, 3);
const round1 = (v) => Math.round(v * 10) / 10;

export function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited ${code}: ${err.slice(-600)}`))));
  });
}

// ------------------------------------------------------------------------------------------ data

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
/** An unsigned JWT: AuthService only decodes `exp` and never verifies the signature. */
export const FAKE_TOKEN = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ exp: 4102444800 })}.`;
export const DEMO_USER = { username: "Demo Cook", email: "demo@example.com", role: "User" };

const CORS = { "access-control-allow-origin": BASE.replace(/\/$/, ""), vary: "Origin" };

/** GET responses from fixtures (null when there is none). */
function fixtureFor(url, signedIn) {
  const fx = fixtures();
  const p = url.pathname;
  if (p === "/api/allRecipes") return { body: fx.all };
  if (p === "/api/getApprovedTestimony") return { body: fx.approved };
  let m = p.match(/^\/api\/viewRecipe\/([^/]+)$/);
  if (m) {
    const one = fx.views.get(decodeURIComponent(m[1]));
    return one ? { body: one } : null;
  }
  if (p === "/api/relatedRecipe") {
    const r = fx.related[url.searchParams.get("cuisine") ?? ""];
    return r ? { body: r } : null;
  }
  if (p === "/api/getSavedRecipes") return signedIn ? { body: fx.saved, mock: true } : { status: 401, body: { message: "Unauthorized" }, mock: true };
  return null;
}

/** Every write the reel performs has an explicit mock here; anything else throws. */
function writeMockFor(method, url) {
  const fx = fixtures();
  const m = url.pathname.match(/^\/api\/savedRecipe\/([^/]+)$/);
  if (method === "POST" && m) {
    const id = decodeURIComponent(m[1]);
    const r = fx.recipes.find((x) => x._id === id);
    if (!r) return { status: 404, body: { message: "Recipe not found" } };
    const body = id === fx.saveResponse.newRecipe.recipeId ? fx.saveResponse : { message: "Added to collection", newRecipe: { _id: `5a7ed0${id.slice(6)}`, recipeId: id, name: r.name, image: r.image, userId: DEMO_USER_ID, __v: 0 } };
    return { status: 201, body };
  }
  return null;
}

/**
 * Installs the shot's data layer on a browser context: fixtures for the API (cross-origin, so
 * every response carries CORS headers and preflights are answered), the photo cache for the CDN.
 * Returns the request log and the list of failures (a non-GET without a mock, a cache miss).
 */
async function installData(context, { signedIn }) {
  const log = [];
  const failures = [];
  const pending = new Set();
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    // whether the request carried the bearer token (a boolean; the value is never kept)
    const entry = { method, path: url.pathname + url.search, auth: !!req.headers()["authorization"] };
    log.push(entry);
    if (method === "OPTIONS") {
      entry.served = "preflight";
      return route.fulfill({
        status: 204,
        headers: { ...CORS, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS", "access-control-max-age": "600" },
      });
    }
    if (method === "GET") {
      const fx = fixtureFor(url, signedIn);
      if (LIVE && fx && !fx.mock) {
        entry.served = "live";
        return route.continue();
      }
      if (!fx) {
        entry.served = "missing";
        failures.push(`GET ${entry.path} has no fixture`);
        return route.fulfill({ status: 599, headers: CORS, contentType: "application/json", body: JSON.stringify({ message: "no fixture" }) });
      }
      entry.served = fx.mock ? "mock" : "fixture";
      return route.fulfill({ status: fx.status ?? 200, headers: CORS, contentType: "application/json", body: JSON.stringify(fx.body) });
    }
    const mock = writeMockFor(method, url);
    if (!mock) {
      entry.served = "refused";
      failures.push(`${method} ${entry.path} has no mock: refusing to let a write reach the API`);
      return route.abort("blockedbyclient");
    }
    entry.served = "mock";
    return route.fulfill({ status: mock.status, headers: CORS, contentType: "application/json", body: JSON.stringify(mock.body) });
  });
  await context.route(`https://${IMAGE_HOST}/**`, async (route) => {
    const url = route.request().url();
    const file = imageCacheFile(url);
    if (!existsSync(file)) {
      failures.push(`photo cache miss: ${url} (run npm run fixtures)`);
      return route.abort("failed");
    }
    const type = existsSync(file + ".type") ? readFileSync(file + ".type", "utf8") : "image/webp";
    return route.fulfill({ status: 200, body: readFileSync(file), contentType: type, headers: { "cache-control": "max-age=31536000", "access-control-allow-origin": "*" } });
  });
  return { log, failures, pending };
}

// ------------------------------------------------------------------------------------- browser

export async function launch() {
  return chromium.launch({ channel: BROWSER.channel, headless: true, args: BROWSER_ARGS });
}

/** Polls from Node in real time, leaving virtual time where it is. */
export async function poll(check, what, timeout = 20000) {
  const started = Date.now();
  for (;;) {
    if (await check()) return;
    if (Date.now() - started > timeout) throw new Error(`timed out waiting for ${what}`);
    await sleep(25);
  }
}

/** Helpers a shot's prepare/events receive. */
function makeContext(page, aspect, net) {
  const { subFps } = ASPECTS[aspect];
  const stepMs = 1000 / subFps;
  const ctx = {
    page,
    aspect,
    vars: {},
    stepMs,
    subFps,
    js: (fn, arg) => page.evaluate(fn, arg),
    poll,
    /** Waits (real time) until no request is in flight, so a response always lands on the same step. */
    settleNetwork: () => settleNetwork(net),
    /** One virtual step of ms, with the network settled first. */
    async step(ms = stepMs) {
      await settleNetwork(net);
      await page.evaluate((m) => window.__vt.step(m), ms);
      await drainTransitions(page);
    },
    /** Advances virtual time without filming. */
    async preroll(seconds, every = stepMs) {
      let left = Math.round((seconds * 1000) / every);
      while (left > 0) {
        await ctx.step(every);
        left--;
      }
    },
    /** Steps virtual time until the page predicate holds (lazy chunks and data land between steps). */
    async until(predicate, what, maxSeconds = 6, arg) {
      for (let i = 0; i < maxSeconds * subFps; i++) {
        if (await page.evaluate(predicate, arg)) return;
        await ctx.step();
        await sleep(4);
      }
      throw new Error(`timed out waiting for ${what}`);
    },
    /**
     * Waits until the page predicate holds without moving virtual time: zero-length steps let
     * Angular render what a response or a lazy chunk brought, at the current virtual moment.
     */
    async settle(predicate, what, timeout = 15000, arg) {
      const started = Date.now();
      for (;;) {
        if (await page.evaluate(predicate, arg)) return;
        if (Date.now() - started > timeout) throw new Error(`timed out (settle) waiting for ${what}`);
        await settleNetwork(net);
        await page.evaluate(() => window.__vt.step(0));
        await drainTransitions(page);
        await sleep(5);
      }
    },
    /**
     * Waits for the display fonts and every on-screen photo (never the plate fallback), plus a decode
     * of any `extraSelectors` images. Loading is real time, so this polls without moving virtual time;
     * only while an on-screen <img> has no src yet (Angular binds it on its next render) does it step.
     */
    async ready(what = "the page", extraSelectors = [], timeout = 30000) {
      const started = Date.now();
      for (;;) {
        const s = await page.evaluate(async (sels) => {
          const onScreen = [...document.images].filter((i) => {
            const r = i.getBoundingClientRect();
            return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 2;
          });
          const unbound = onScreen.filter((i) => !i.getAttribute("src")).length;
          const fonts = document.fonts.status === "loaded" && document.fonts.check('40px "Dela Gothic One"') && document.fonts.check('800 20px "Archivo Variable"');
          let decoded = true;
          for (const sel of sels) {
            for (const img of document.querySelectorAll(sel)) {
              if (!img.getAttribute("src") || !img.complete || !(img.naturalWidth > 0)) decoded = false;
              else await img.decode().catch(() => (decoded = false));
            }
          }
          return { unbound, fonts, decoded, broken: window.__vt.brokenImages() };
        }, extraSelectors);
        if (s.fonts && s.decoded && !s.unbound && !s.broken.length) return;
        if (Date.now() - started > timeout) throw new Error(`timed out waiting for fonts and photos on ${what}: ${JSON.stringify(s)}`);
        // an unbound <img>, or the plate a data-less render shows, needs Angular's next render: step
        if (s.unbound || s.broken.some((b) => /plate\.svg$/.test(b))) await ctx.step();
        else await sleep(25);
      }
    },
    /** Viewport rect of a locator, with its centre. */
    async box(locator) {
      const b = await locator.boundingBox();
      if (!b) throw new Error(`not visible: ${locator}`);
      return { x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
    },
    docTop: (selector) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + window.scrollY, selector),
    scrollTo: (y) => page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y),
  };
  return ctx;
}

async function settleNetwork(net, timeout = 15000) {
  const started = Date.now();
  while (net.inflight.size) {
    if (Date.now() - started > timeout) throw new Error(`requests still in flight: ${[...net.inflight].map((r) => r.url()).join(", ")}`);
    await sleep(3);
  }
  if (net.lastDone && Date.now() - net.lastDone < 12) await sleep(12 - (Date.now() - net.lastDone));
}

/**
 * A view transition asked for during a step is still waiting for its DOM update or its snapshots:
 * run zero-length steps (Angular's render and its follow-up timer run, virtual time stays put) and
 * give Chrome real frames until the transition is ready, so it starts at the moment it was asked
 * for and never hits Chrome's 4 s "DOM update timed out" abort.
 */
async function drainTransitions(page, timeout = 4000) {
  const started = Date.now();
  while (await page.evaluate(() => window.__vt.vtPending)) {
    if (Date.now() - started > timeout) throw new Error("a view transition never became ready");
    await page.evaluate(() => window.__vt.step(0));
    await sleep(6);
  }
}

/** Resolves a pointer target to viewport coordinates. */
async function resolveTarget(ctx, to, current) {
  if (to === "off") return null;
  if (to === "hold") return current ? { ...current } : null;
  if (Array.isArray(to)) return { x: to[0], y: to[1] };
  const p = await to(ctx, current);
  return Array.isArray(p) ? { x: p[0], y: p[1] } : p;
}

/**
 * The pointer at shot time t: cursor keys glide between targets on an eased, gently bowed path
 * (targets resolve when their segment starts; "hold" stays where the pointer is), and a drag
 * overrides the keys while it runs.
 */
function makePointer(ctx, cursorKeys = [], drags = []) {
  // a drag's release is a key of its own: the pointer lets go where the drag stopped, even when the
  // release falls between two subframes, and the next glide starts from there
  const keys = [...cursorKeys, ...drags.map((d) => ({ at: d.at + d.dur, to: { dragEnd: d } }))].sort((a, b) => a.at - b.at);
  const resolved = new Map();
  let current = null;
  const target = async (i) => {
    if (!resolved.has(i)) {
      const to = keys[i].to;
      resolved.set(i, to && to.dragEnd ? (to.dragEnd.b ? { ...to.dragEnd.b } : current) : await resolveTarget(ctx, to, current));
    }
    return resolved.get(i);
  };
  return async (t) => {
    for (const d of drags) {
      if (t >= d.at - 1e-9 && t <= d.at + d.dur + 1e-9) {
        d.a ??= await resolveTarget(ctx, d.from, current);
        d.b ??= await resolveTarget(ctx, d.to, d.a);
        const u = dragEase(clamp01((t - d.at) / d.dur));
        current = { x: d.a.x + (d.b.x - d.a.x) * u, y: d.a.y + (d.b.y - d.a.y) * u };
        return current;
      }
    }
    if (!keys.length || t < keys[0].at) return (current = null);
    let i = 0;
    while (i + 1 < keys.length && t >= keys[i + 1].at) i++;
    const a = await target(i);
    if (i + 1 >= keys.length || !a) return (current = a);
    const b = await target(i + 1);
    if (!b) return (current = a);
    const u = easeInOut(clamp01((t - keys[i].at) / (keys[i + 1].at - keys[i].at)));
    // a gentle bow, as a hand moves
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, bow = Math.min(50, len * 0.1) * Math.sin(Math.PI * u);
    current = { x: a.x + dx * u - (dy / len) * bow, y: a.y + dy * u + (dx / len) * bow };
    return current;
  };
}

const ANCHOR_FN = (specs) =>
  Object.fromEntries(
    Object.entries(specs).map(([name, s]) => {
      let els = [...document.querySelectorAll(s.sel)];
      if (s.text) els = els.filter((e) => (e.textContent ?? "").includes(s.text));
      if (s.visible) els = els.filter((e) => e.getClientRects().length > 0 && window.getComputedStyle(e).visibility !== "hidden");
      const el = els[s.nth ?? 0];
      if (!el) return [name, null];
      const r = el.getBoundingClientRect();
      return [name, [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10)];
    }),
  );

/** Storage the shot starts with, written before any page script (session, intro flag, Cook Mode). */
function initScript(init) {
  return ({ session, local, token, user }) => {
    try {
      if (session) for (const [k, v] of Object.entries(session)) sessionStorage.setItem(k, v);
      if (token) {
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("userDetails", user);
      }
      if (local) for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
    } catch {}
  };
}

/** A touch point for the 9:16 cut (CDP, so taps and swipes are real touch input). */
async function touch(cdp, type, p) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: p.x, y: p.y, radiusX: 8, radiusY: 8, force: 1 }] });
}

/**
 * Films one shot. `shot` fields: path, duration, signedIn, intro (true = leave cwm.intro.v1 unset),
 * init { session, local }, css, prepare(ctx), cursor [{at, to}], clicks [t] (activation = release),
 * drags [{at, from, to, dur}], events [{at, run}], rand [{at, values}], scroll(t, ctx), anchors,
 * fps (override, for the 60 fps fallback).
 */
export async function captureShot(browser, id, shot, { aspect = "16x9", outDir = path.join(OUT, aspect), quiet = false, shotEvery = 1 } = {}) {
  const A = ASPECTS[aspect];
  const subFps = shot.fps ?? A.subFps;
  const stepMs = 1000 / subFps;
  const dir = path.join(outDir, id);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });

  const context = await browser.newContext({
    viewport: A.viewport,
    deviceScaleFactor: A.dsf,
    isMobile: A.touch,
    hasTouch: A.touch,
    reducedMotion: "no-preference",
    colorScheme: "light",
    serviceWorkers: "block",
  });
  await context.addInitScript(VCLOCK_SCRIPT);
  const session = { ...(shot.init?.session ?? {}) };
  if (!shot.intro) session["cwm.intro.v1"] = "1";
  await context.addInitScript(initScript(), {
    session,
    local: shot.init?.local ?? null,
    token: shot.signedIn ? FAKE_TOKEN : null,
    user: shot.signedIn ? JSON.stringify(DEMO_USER) : null,
  });
  const data = await installData(context, { signedIn: !!shot.signedIn });

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  const baseHost = new URL(BASE).host;
  const allowed = new Set([baseHost, new URL(API).host, IMAGE_HOST]);
  const stray = new Set();
  const net = { inflight: new Set(), lastDone: 0 };
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!u.protocol.startsWith("http")) return;
    if (!allowed.has(u.host)) stray.add(u.host);
    net.inflight.add(r);
  });
  const done = (r) => {
    net.inflight.delete(r);
    net.lastDone = Date.now();
  };
  page.on("requestfinished", done);
  page.on("requestfailed", done);
  const cdp = A.touch ? await context.newCDPSession(page) : null;

  const started = Date.now();
  await page.goto(BASE + shot.path, { waitUntil: "domcontentloaded" });
  const ctx = makeContext(page, aspect, net);
  ctx.id = id;
  // boot: Angular schedules through the (virtual) timers, so step until the route has rendered
  await ctx.until(() => !!document.querySelector("router-outlet + *"), "the route to render", 8);
  if (shot.css) await page.addStyleTag({ content: shot.css });
  await shot.prepare?.(ctx);
  if (!A.touch) await page.mouse.move(A.viewport.width / 2, A.viewport.height + 60);

  const drags = (shot.drags ?? []).map((d) => ({ ...d, state: 0 }));
  const pointerAt = makePointer(ctx, shot.cursor, drags);
  const clicks = [
    ...(shot.clicks ?? []).map((c) => ({ down: c - PRESS_S, up: c, state: 0 })),
    // a hold: the button goes down and is never released inside the footage (a cut carries the action)
    ...(shot.holds ?? []).map((c) => ({ down: c, up: Infinity, state: 0, hold: true })),
  ];
  const events = (shot.events ?? []).map((e) => ({ ...e, done: false }));
  const rands = (shot.rand ?? []).map((r) => ({ ...r, done: false }));
  const total = Math.round(shot.duration * subFps);
  const meta = {
    id, aspect, fps: subFps, dsf: A.dsf, width: A.viewport.width, height: A.viewport.height,
    input: A.touch ? "touch" : "mouse", browser: `${BROWSER.channel} r${BROWSER.revision} ${browser.version()}`,
    presses: [], drags: [], marks: {}, frames: [],
  };
  ctx.mark = (name, value) => (meta.marks[name] = value ?? Math.round((ctx.t ?? 0) * 1e4) / 1e4);
  let pressed = false;
  let last = null;
  const failures = [];
  meta.t0 = await page.evaluate(() => window.__vt.now);

  for (let i = 0; i < total; i++) {
    const t = i / subFps;
    ctx.t = t;
    // 1. scripted hooks due now (they may wait in real time, never move virtual time)
    for (const e of events) {
      if (!e.done && t >= e.at - 1e-9) {
        e.done = true;
        await e.run(ctx);
      }
    }
    for (const r of rands) {
      if (!r.done && t >= r.at - 1e-9) {
        r.done = true;
        await page.evaluate((v) => window.__vt.rand(v), r.values);
      }
    }
    // 2. scroll, then advance virtual time to t
    const y = shot.scroll ? shot.scroll(t, ctx) : null;
    await settleNetwork(net);
    await page.evaluate(([top, ms]) => {
      if (top !== null && top !== undefined) window.scrollTo({ top, behavior: "instant" });
      return window.__vt.step(ms);
    }, [y, i === 0 ? 0 : stepMs]);
    await drainTransitions(page);
    // 3. input at t: whatever it starts begins at local time 0 at t, and its first effects are in this frame
    const m = await pointerAt(t);
    // Swipes are pointer drags dispatched through the mouse, on both cuts: headless Chrome's emulated
    // touch moves are always cancelled (pointercancel on the first move, whatever the touch-action),
    // while the app's gesture handlers take any pointer type. Taps on the 9:16 cut stay real touches.
    const dragging = drags.some((d) => d.state === 1);
    if (m && (!last || m.x !== last.x || m.y !== last.y)) {
      if (!A.touch || dragging) await page.mouse.move(m.x, m.y);
    }
    last = m;
    for (const c of clicks) {
      if (c.state === 0 && t >= c.down - 1e-9) {
        if (!m) throw new Error(`[${id}] press at ${c.down}s with no pointer on screen`);
        if (A.touch) await touch(cdp, "touchStart", m);
        else await page.mouse.down();
        c.state = 1;
        pressed = true;
        c.at = { x: round1(m.x), y: round1(m.y) };
        if (c.hold) meta.presses.push({ down: Math.round(c.down * 1e4) / 1e4, up: null, x: c.at.x, y: c.at.y });
      } else if (c.state === 1 && t >= c.up - 1e-9) {
        if (A.touch) await touch(cdp, "touchEnd", m);
        else await page.mouse.up();
        c.state = 2;
        pressed = false;
        meta.presses.push({ down: Math.round(c.down * 1e4) / 1e4, up: Math.round(c.up * 1e4) / 1e4, x: c.at.x, y: c.at.y });
      }
    }
    for (const d of drags) {
      if (d.state === 0 && t >= d.at - 1e-9) {
        await page.mouse.move(m.x, m.y);
        await page.mouse.down();
        d.state = 1;
        pressed = true;
      } else if (d.state === 1 && t >= d.at + d.dur - 1e-9) {
        await page.mouse.up();
        d.state = 2;
        pressed = false;
        meta.drags.push({ at: d.at, dur: d.dur, from: [round1(d.a.x), round1(d.a.y)], to: [round1(d.b.x), round1(d.b.y)] });
      }
    }
    // 4. record and photograph
    const frame = { m: m ? [round1(m.x), round1(m.y), pressed ? 1 : 0] : null };
    if (shot.anchors && i % 3 === 0) frame.a = await page.evaluate(ANCHOR_FN, shot.anchors);
    if (i % 3 === 0) {
      const broken = await page.evaluate(() => window.__vt.brokenImages());
      if (broken.length) failures.push(`frame ${i} (${t.toFixed(3)}s): photo not ready or plate fallback: ${broken.slice(0, 3).join(", ")}`);
    }
    meta.frames.push(frame);
    if (i % shotEvery === 0) await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
    if (!quiet && (i + 1) % (subFps * 2) === 0) console.log(`  [${aspect} ${id}] ${i + 1}/${total} subframes, ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  // frame i must be exactly t0 + i steps of virtual time: nothing may have stepped the clock behind the loop's back
  const elapsed = (await page.evaluate(() => window.__vt.now)) - meta.t0;
  const expected = (total - 1) * stepMs;
  if (Math.abs(elapsed - expected) > 0.01) failures.push(`virtual time drifted: ${elapsed.toFixed(3)} ms elapsed over ${total} frames, expected ${expected.toFixed(3)}`);

  meta.network = data.log;
  meta.rand = await page.evaluate(() => window.__vt.randLog);
  meta.vtStats = await page.evaluate(() => window.__vt.stats);
  meta.fonts = await page.evaluate(() => ({
    status: document.fonts.status,
    dela: document.fonts.check('40px "Dela Gothic One"'),
    archivo: document.fonts.check('800 20px "Archivo Variable"'),
  }));
  meta.captureSeconds = Math.round((Date.now() - started) / 100) / 10;
  if (shot.verify) {
    try {
      await shot.verify(ctx, meta);
    } catch (e) {
      failures.push(`verify: ${e.message ?? e}`);
    }
  }
  await context.close();

  const problems = [...data.failures, ...failures];
  if (stray.size) problems.push(`the page contacted ${[...stray].join(", ")} during the shot`);
  if (!meta.fonts.dela || !meta.fonts.archivo) problems.push(`fonts not loaded: ${JSON.stringify(meta.fonts)}`);
  const nonGet = data.log.filter((r) => r.method !== "GET" && r.method !== "OPTIONS");
  if (nonGet.some((r) => r.served !== "mock")) problems.push(`a write was not mocked: ${JSON.stringify(nonGet)}`);
  meta.errors = errors;
  meta.problems = problems;
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta));
  if (problems.length) throw new Error(`[${aspect} ${id}] ${problems.join("; ")}`);
  if (!quiet) console.log(`  [${aspect} ${id}] done: ${total} subframes in ${meta.captureSeconds}s${errors.length ? ` (page errors: ${errors.length})` : ""}`);
  return { dir, meta };
}

/** One frame every 0.25 s of a captured shot, tiled for review. */
export async function sheet(id, { aspect = "16x9", outDir = path.join(OUT, aspect), every = 0.25, cols } = {}) {
  const dir = path.join(outDir, id);
  const meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf8"));
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
  const stride = Math.max(1, Math.round(every * meta.fps));
  const pick = files.filter((f) => Number(f.slice(0, 5)) % stride === 0);
  const tmp = path.join(outDir, `${id}-sheet-src`);
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp);
  await Promise.all(pick.map((f, i) => fs.copyFile(path.join(dir, f), path.join(tmp, `${String(i).padStart(3, "0")}.jpg`))));
  const portrait = meta.height > meta.width;
  const c = cols ?? (portrait ? 8 : 5);
  const rows = Math.ceil(pick.length / c);
  const scale = portrait ? "216:384" : "480:270";
  const file = path.join(outDir, `${id}-sheet.jpg`);
  await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "1", "-i", path.join(tmp, "%03d.jpg"), "-vf", `scale=${scale},tile=${c}x${rows}:padding=6:margin=6:color=0x1C0F0A`, "-frames:v", "1", file]);
  await fs.rm(tmp, { recursive: true, force: true });
  return file;
}

export async function captureShots(SHOTS, ids, { aspect = "16x9", workers = 3, sheets = false, draft = false } = {}) {
  // --draft steps at the full subframe rate but keeps every 15th still, in out/draft/<aspect>/ (for quick review)
  const outDir = draft ? path.join(here, "out", "draft", aspect) : path.join(OUT, aspect);
  await fs.mkdir(outDir, { recursive: true });
  const browser = await launch();
  const results = [];
  const failures = [];
  try {
    const queue = [...ids];
    await Promise.all(
      [...Array(Math.min(workers, queue.length))].map(async () => {
        for (let id = queue.shift(); id; id = queue.shift()) {
          console.log(`shot ${aspect} ${id}: ${SHOTS[id].duration}s`);
          try {
            // a draft keeps the stills a review sheet needs (one per 0.25 s): 15 at 180 fps, 23 at 90
            const every = draft ? Math.round(ASPECTS[aspect].subFps * 0.25) / (ASPECTS[aspect].subFps === 180 ? 3 : 1) : 1;
            results.push(await captureShot(browser, id, SHOTS[id], { aspect, outDir, shotEvery: every }));
          } catch (e) {
            failures.push(e.message ?? String(e));
            console.error(`  FAILED ${e.message ?? e}`);
            continue;
          }
          if (sheets) console.log(`  sheet: ${await sheet(id, { aspect, outDir })}`);
        }
      }),
    );
  } finally {
    await browser.close();
  }
  if (failures.length) throw new Error(`${failures.length} shot(s) failed:\n${failures.join("\n")}`);
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const value = (n) => {
    const i = argv.indexOf(n);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const aspect = value("--aspect") ?? "16x9";
  if (!ASPECTS[aspect]) throw new Error(`--aspect must be ${Object.keys(ASPECTS).join(" or ")}`);
  const { SHOTS } = await import(aspect === "9x16" ? "./shots-vertical.mjs" : "./shots.mjs");
  const flagValues = new Set([value("--aspect"), value("--workers")].filter(Boolean));
  const ids = argv.filter((a) => !a.startsWith("--") && !flagValues.has(a));
  for (const id of ids) if (!SHOTS[id]) throw new Error(`unknown shot ${id}; choose from ${Object.keys(SHOTS).join(", ")}`);
  const sheetOnly = argv.includes("--sheet-only");
  if (sheetOnly) {
    for (const id of ids.length ? ids : Object.keys(SHOTS)) console.log(await sheet(id, { aspect }));
  } else {
    await captureShots(SHOTS, ids.length ? ids : Object.keys(SHOTS), {
      aspect,
      workers: value("--workers") ? Number(value("--workers")) : Math.max(1, Math.min(3, os.cpus().length - 4)),
      sheets: argv.includes("--sheet") || argv.includes("--draft"),
      draft: argv.includes("--draft"),
    }).catch((e) => {
      console.error(e.message ?? e);
      process.exit(1);
    });
  }
}
