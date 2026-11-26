#!/usr/bin/env node
/**
 * Renders the 45-second Cook With Me reel (reel.html) from the captured shots, and encodes it.
 *
 *   npm run render                             # 16:9: 2,700 frames → master + README web cut + thumbnail
 *   npm run render -- --aspect 9x16            # 9:16: 1,350 frames → vertical cut + cover
 *   npm run beats [-- --aspect 9x16]           # review: one frame every 0.5 s (90) on a contact sheet
 *   node render.mjs --at 2.0,9.5               # review: single frames at these seconds
 *   node render.mjs --range 1.4,2.4,0.05       # review: a strip of frames as a contact sheet
 *   npm run audio                              # the score only (out/cook-with-me-reel.wav)
 *   node render.mjs --encode [--aspect 9x16]   # re-encode the last render's frames and WAV
 *   node render.mjs --crf 23                   # master CRF (default 22)
 *
 * A tiny local server serves this folder (the page, the score, the captured shots, the
 * fixtures), the app's own font files (frontend/node_modules) and the photo cache
 * (out/cache/images). N headless pages render frames in parallel through window.renderFrame(k);
 * frames are JPEG q97, then ffmpeg converts full-range BT.601 to tagged BT.709 tv-range and
 * encodes. Loudness is measured on every encoded file (ebur128); if a file misses −14 LUFS
 * integrated / −1 dBTP, the WAV is loudnorm-ed (two-pass, linear) and the files are re-muxed.
 */
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, readFileSync, promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import ffmpegPath from "ffmpeg-static";
import { BROWSER, BROWSER_ARGS } from "./capture.mjs";
import { imageCacheFile } from "./fixtures.mjs";
import { DURATION, FPS as TL_FPS } from "./timeline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const fontRoot = path.join(root, "frontend", "node_modules");
const outDir = path.join(here, "out");
const docs = path.join(root, "docs", "reel");
const TARGETS = {
  "16x9": { w: 1920, h: 1080, file: path.join(docs, "cook-with-me-reel.mp4"), web: path.join(docs, "cook-with-me-reel-web.mp4"), still: path.join(docs, "cook-with-me-reel-thumb.jpg") },
  "9x16": { w: 1080, h: 1920, file: path.join(docs, "cook-with-me-reel-vertical.mp4"), still: path.join(docs, "cook-with-me-reel-vertical-cover.jpg") },
};
/** GitHub's README drag-and-drop limit is 10 MB; the brief's budget is 9.4 MB, held here as 9.4 × 10⁶ bytes
 *  (the stricter reading), with the two-pass bitrate aimed 4 % under it for container overhead. */
const WEB_BYTES = 9.4e6;
const WEB_AIM = WEB_BYTES * 0.96;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

function serve() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://localhost");
    const p = decodeURIComponent(u.pathname);
    if (p === "/favicon.ico") return res.writeHead(204).end();
    let file;
    if (p === "/photo") {
      file = imageCacheFile(u.searchParams.get("url") ?? "");
      if (!existsSync(file)) return res.writeHead(404).end();
      res.writeHead(200, { "content-type": existsSync(file + ".type") ? readFileSync(file + ".type", "utf8") : "image/webp", "cache-control": "no-store" });
      return createReadStream(file).pipe(res);
    }
    const [base, rel] = p.startsWith("/fonts/") ? [fontRoot, p.slice("/fonts".length)] : [here, p === "/" ? "/reel.html" : p];
    file = path.join(base, rel);
    if (!file.startsWith(base + path.sep) || !existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function openPages(count, url, size) {
  const browser = await chromium.launch({ channel: BROWSER.channel, headless: true, args: BROWSER_ARGS });
  const pages = await Promise.all(
    [...Array(count)].map(async () => {
      const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
      page.on("pageerror", (e) => console.error("page error:", e.message));
      page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
      await page.goto(url, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 180000 });
      const err = await page.evaluate(() => window.__error);
      if (err) throw new Error(err);
      return page;
    }),
  );
  const info = await pages[0].evaluate(() => window.REEL);
  if (!info.fonts.dela || !info.fonts.archivo) throw new Error(`the compositor's fonts did not load: ${JSON.stringify(info.fonts)}`);
  return { browser, pages, info };
}

async function frame(page, k, file, opts) {
  await page.evaluate(([i, o]) => window.renderFrame(i, o), [k, opts ?? null]);
  await page.screenshot({ path: file, type: "jpeg", quality: 97 });
}

function run(cmd, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", capture ? "pipe" : "inherit", capture ? "pipe" : "inherit"] });
    let out = "";
    if (capture) {
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (out += d));
    }
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${path.basename(cmd)} exited with ${code}${capture ? `: ${out.slice(-800)}` : ""}`))));
  });
}
const ffmpeg = (args, opts) => run(ffmpegPath, ["-hide_banner", "-loglevel", opts?.capture ? "info" : "error", "-y", ...args], opts);
/** JPEG frames are full-range BT.601; browsers expect tagged BT.709 for HD, or colours shift. */
const TO_709 = "scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv";
const TAG_709 = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];

async function renderAudio(page) {
  const b64 = await page.evaluate(() => window.renderAudio());
  const file = path.join(outDir, "cook-with-me-reel.wav");
  await fs.writeFile(file, Buffer.from(b64, "base64"));
  return file;
}

/** Frames at the given times, tiled into one contact sheet. */
async function sheet(page, times, name, cols, size, aspect) {
  const dir = path.join(outDir, "review", aspect, name);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const fps = TL_FPS[aspect];
  for (let i = 0; i < times.length; i++) await frame(page, Math.round(times[i] * fps), path.join(dir, `${String(i).padStart(3, "0")}.jpg`));
  const rows = Math.ceil(times.length / cols);
  const file = path.join(outDir, "review", aspect, `${name}.jpg`);
  const tile = size.w > size.h ? "480:270" : "216:384";
  await ffmpeg(["-framerate", "1", "-i", path.join(dir, "%03d.jpg"), "-vf", `scale=${tile},tile=${cols}x${rows}:padding=6:margin=6:color=0x1C0F0A`, "-frames:v", "1", file]);
  return file;
}

/** Integrated loudness and true peak of a file's audio (ffmpeg ebur128). */
export async function loudness(file) {
  const out = await ffmpeg(["-nostats", "-i", file, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"], { capture: true });
  const summary = out.slice(out.lastIndexOf("Summary:"));
  const I = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
  const LRA = Number(summary.match(/LRA:\s+(-?[\d.]+) LU/)?.[1]);
  const TP = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
  return { I, LRA, TP };
}

/** Two-pass loudnorm (linear) of the WAV to −14 LUFS / −1.5 dBTP, used only when an encode misses. */
async function normaliseWav(wav) {
  const first = await ffmpeg(["-i", wav, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { capture: true });
  const json = JSON.parse(first.slice(first.lastIndexOf("{"), first.lastIndexOf("}") + 1));
  const out = wav.replace(/\.wav$/, "-norm.wav");
  await ffmpeg(["-i", wav, "-af", `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true`, "-ar", "48000", "-c:a", "pcm_s16le", out]);
  return out;
}

async function encodeMaster(aspect, frames, wav, crf) {
  const t = TARGETS[aspect];
  const fps = TL_FPS[aspect];
  if (aspect === "16x9") {
    await ffmpeg([
      "-framerate", String(fps), "-i", path.join(frames, "%05d.jpg"), "-i", wav, "-map", "0:v", "-map", "1:a",
      "-vf", `${TO_709},format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", String(crf ?? 22), "-profile:v", "high", "-level", "4.2", "-g", "120",
      ...TAG_709, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-t", String(DURATION), "-movflags", "+faststart", t.file,
    ]);
  } else {
    await ffmpeg([
      "-framerate", String(fps), "-i", path.join(frames, "%05d.jpg"), "-i", wav, "-map", "0:v", "-map", "1:a",
      "-vf", `${TO_709},format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", String(crf ?? 20), "-maxrate", "10M", "-bufsize", "20M", "-profile:v", "high", "-level", "4.2", "-g", "60",
      ...TAG_709, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-t", String(DURATION), "-movflags", "+faststart", t.file,
    ]);
  }
}

async function encodeWeb(frames, wav) {
  const t = TARGETS["16x9"];
  const audioKbps = 96;
  const videoKbps = Math.floor((WEB_AIM * 8) / DURATION / 1000 - audioKbps - 40);
  const webIn = ["-framerate", "60", "-i", path.join(frames, "%05d.jpg")];
  const webOut = ["-vf", `fps=30,scale=1280:720:flags=lanczos,${TO_709},format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-b:v", `${videoKbps}k`, "-maxrate", `${Math.round(videoKbps * 1.6)}k`, "-bufsize", `${videoKbps * 2}k`, "-profile:v", "high", "-level", "4.0", "-g", "60", ...TAG_709];
  const passlog = path.join(outDir, "web-pass");
  await ffmpeg([...webIn, ...webOut, "-pass", "1", "-passlogfile", passlog, "-an", "-t", String(DURATION), "-f", "mp4", os.devNull]);
  await ffmpeg([...webIn, "-i", wav, ...webOut, "-map", "0:v", "-map", "1:a", "-pass", "2", "-passlogfile", passlog, "-c:a", "aac", "-b:a", `${audioKbps}k`, "-ar", "48000", "-ac", "2", "-t", String(DURATION), "-movflags", "+faststart", t.web]);
  return videoKbps;
}

async function encodeAll(aspect, frames, wavIn, crf) {
  const t = TARGETS[aspect];
  await fs.mkdir(docs, { recursive: true });
  let wav = wavIn;
  const files = () => (aspect === "16x9" ? [t.file, t.web] : [t.file]);
  const budget = async () => {
    if (aspect !== "16x9") return;
    const { size } = await fs.stat(t.web);
    if (size > WEB_BYTES) throw new Error(`web cut is ${size} bytes, over the ${WEB_BYTES}-byte budget`);
  };
  const encode = async () => {
    await encodeMaster(aspect, frames, wav, crf);
    if (aspect === "16x9") await encodeWeb(frames, wav);
  };
  await encode();
  let levels = await Promise.all(files().map(loudness));
  const miss = levels.some((l) => Math.abs(l.I + 14) > 1 || l.TP > -1.0);
  if (miss) {
    console.log(`loudness ${JSON.stringify(levels)} misses −14 ±1 LUFS / ≤ −1 dBTP: two-pass loudnorm on the WAV, re-mux`);
    wav = await normaliseWav(wav);
    await encode();
    levels = await Promise.all(files().map(loudness));
  }
  await budget();
  for (const [i, f] of files().entries()) {
    const { size } = await fs.stat(f);
    console.log(`${path.relative(root, f)}: ${(size / 1048576).toFixed(2)} MB, ${levels[i].I} LUFS, ${levels[i].TP} dBTP, LRA ${levels[i].LRA}`);
  }
  return { wav, levels };
}

/** The poster: 16:9 = the end card at 43.6 s with a play glyph on the dish; 9:16 = the title at 1.3 s. */
async function renderStill(page, aspect) {
  const t = TARGETS[aspect];
  const fps = TL_FPS[aspect];
  const tmp = path.join(outDir, `still-${aspect}.jpg`);
  if (aspect === "16x9") await frame(page, Math.round(43.6 * fps), tmp, { play: true });
  else await frame(page, Math.round(1.3 * fps), tmp);
  await fs.mkdir(docs, { recursive: true });
  // a JPEG poster stays an ordinary sRGB JPEG: re-encoded at a sensible size, no matrix change
  await ffmpeg(["-i", tmp, "-q:v", "2", t.still]);
  console.log(`still: ${path.relative(root, t.still)} (${((await fs.stat(t.still)).size / 1024).toFixed(0)} KB)`);
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(n);
  const value = (n) => {
    const i = argv.indexOf(n);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const aspect = value("--aspect") ?? "16x9";
  if (!TARGETS[aspect]) throw new Error("--aspect must be 16x9 or 9x16");
  const size = TARGETS[aspect];
  const fps = TL_FPS[aspect];
  await fs.mkdir(path.join(outDir, "review", aspect), { recursive: true });
  const frames = path.join(outDir, "frames", aspect);

  if (flag("--encode")) {
    const wav = path.join(outDir, "cook-with-me-reel.wav");
    await encodeAll(aspect, frames, wav, value("--crf"));
    return;
  }

  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/reel.html?aspect=${aspect}`;
  const review = flag("--beats") || value("--at") || value("--range") || value("--sheet-at") || flag("--audio") || flag("--holes") || flag("--stills");
  const workers = review ? 1 : Number(value("--workers") ?? Math.max(2, Math.min(6, os.cpus().length - 4)));
  const { browser, pages } = await openPages(workers, url, size);
  try {
    if (flag("--audio")) return console.log("audio:", await renderAudio(pages[0]));
    if (flag("--holes")) return console.log("deal coverage:", JSON.stringify(await pages[0].evaluate(() => window.dealHoles())));
    if (flag("--stills")) return await renderStill(pages[0], aspect);
    if (value("--at")) {
      for (const t of value("--at").split(",").map(Number)) {
        const file = path.join(outDir, "review", aspect, `frame-${t.toFixed(2)}.jpg`);
        await frame(pages[0], Math.round(t * fps), file);
        console.log(file);
      }
      return;
    }
    if (value("--range")) {
      const [a, b, step] = value("--range").split(",").map(Number);
      const times = [];
      for (let t = a; t <= b + 1e-9; t += step) times.push(Math.round(t * 1000) / 1000);
      return console.log("range sheet:", await sheet(pages[0], times, `range-${a}-${b}`, Number(value("--cols") ?? (aspect === "16x9" ? 5 : 8)), size, aspect));
    }
    if (value("--sheet-at")) {
      const times = value("--sheet-at").split(",").map(Number);
      return console.log("sheet:", await sheet(pages[0], times, value("--name") ?? "sheet-at", Number(value("--cols") ?? 3), size, aspect));
    }
    if (flag("--beats")) {
      const offset = Number(value("--offset") ?? 0.25);
      const times = [...Array(90)].map((_, i) => i * 0.5 + offset);
      return console.log("beats sheet:", await sheet(pages[0], times, "beats", aspect === "16x9" ? 9 : 15, size, aspect));
    }

    // the full render
    const started = Date.now();
    await fs.rm(frames, { recursive: true, force: true });
    await fs.mkdir(frames, { recursive: true });
    const total = await pages[0].evaluate(() => window.FRAMES);
    let next = 0, done = 0;
    await Promise.all(
      pages.map(async (page) => {
        for (let k = next++; k < total; k = next++) {
          await frame(page, k, path.join(frames, `${String(k).padStart(5, "0")}.jpg`));
          if (++done % (fps * 5) === 0) console.log(`  ${done}/${total} frames, ${((Date.now() - started) / 1000).toFixed(0)}s`);
        }
      }),
    );
    const renderSeconds = (Date.now() - started) / 1000;
    console.log(`rendered ${total} frames in ${renderSeconds.toFixed(0)}s with ${pages.length} pages`);
    await renderStill(pages[0], aspect);
    const wav = await renderAudio(pages[0]);
    await browser.close();
    server.close();
    await encodeAll(aspect, frames, wav, value("--crf"));
    await fs.writeFile(path.join(outDir, `render-${aspect}.json`), JSON.stringify({ frames: total, renderSeconds, workers: pages.length }, null, 2));
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
}

export { serve, openPages, frame, TARGETS };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
