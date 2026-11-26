#!/usr/bin/env node
/**
 * The reel's acceptance checks (brief §11), with the numbers.
 *
 *   node verify.mjs                      # 16:9: specs, durations, loudness, sync, fonts, network, house rules, determinism
 *   node verify.mjs --aspect 9x16        # the vertical cut
 *   node verify.mjs --determinism-shot I # also compare this shot's meta.json anchors with out/debug/<id>-meta-run1.json
 *
 * Writes out/verify-<aspect>.json and exits non-zero when a check fails.
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import * as TL from "./timeline.mjs";
import { cover, coverRate, crossings, landingRotation } from "./lib/cover.js";
import { serve, openPages, frame, TARGETS } from "./render.mjs";
import { loudness } from "./render.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const argv = process.argv.slice(2);
const value = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};
const aspect = value("--aspect") ?? "16x9";
const T = TARGETS[aspect];
const FPS = TL.FPS[aspect];
const frameS = 1 / FPS;
const results = [];
const check = (id, ok, detail, data) => {
  results.push({ id, ok: !!ok, detail, data });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail}`);
};

function ffmpeg(args) {
  return new Promise((resolve) => {
    const p = spawn(ffmpegPath, ["-hide_banner", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", () => resolve(out));
  });
}

async function probe(file) {
  const info = await ffmpeg(["-i", file]);
  const v = info.match(/Video: (\w+) \((\w+)\)[^,]*, (\w+)\(([^)]*)\)[^,]*, (\d+)x(\d+).*?, ([\d.]+) fps/);
  const a = info.match(/Audio: (\w+) \((\w+)\)[^,]*, (\d+) Hz, (\w+)/);
  const vf = (await ffmpeg(["-i", file, "-map", "0:v", "-f", "null", "-"])).match(/frame=\s*(\d+)/g)?.pop();
  const af = await ffmpeg(["-i", file, "-map", "0:a", "-af", "astats=metadata=0:reset=0", "-f", "null", "-"]);
  const samples = Number(af.match(/Number of samples:\s*(\d+)/)?.[1] ?? NaN);
  return {
    codec: v?.[1], profile: v?.[2], pix: v?.[3], color: v?.[4], w: Number(v?.[5]), h: Number(v?.[6]), fps: Number(v?.[7]),
    audio: a ? { codec: a[1], profile: a[2], rate: Number(a[3]), layout: a[4] } : null,
    videoFrames: Number(vf?.match(/\d+/)?.[0]),
    audioSeconds: samples / Number(a?.[3] ?? 48000),
    bytes: (await fs.stat(file)).size,
    duration: info.match(/Duration: ([\d:.]+)/)?.[1],
  };
}

async function main() {
  const files = aspect === "16x9" ? [T.file, T.web] : [T.file];
  const specs = { [T.file]: aspect === "16x9" ? { w: 1920, h: 1080, fps: 60 } : { w: 1080, h: 1920, fps: 30 } };
  if (T.web) specs[T.web] = { w: 1280, h: 720, fps: 30 };

  // 1 + 2: durations and specs
  for (const f of files) {
    const p = await probe(f);
    const s = specs[f];
    const name = path.relative(root, f);
    const vDur = p.videoFrames / p.fps;
    check(`1 duration ${name}`, Math.abs(vDur - TL.DURATION) <= 1 / p.fps + 1e-9 && Math.abs(p.audioSeconds - vDur) <= 1 / p.fps + 1e-9,
      `video ${p.videoFrames} frames = ${vDur.toFixed(3)} s, audio ${p.audioSeconds.toFixed(3)} s (container ${p.duration})`, p);
    const colorOk = /tv, bt709/.test(p.color ?? "");
    check(`2 spec ${name}`, p.w === s.w && p.h === s.h && p.fps === s.fps && p.codec === "h264" && p.profile === "High" && p.pix === "yuv420p" && colorOk && p.audio?.codec === "aac" && p.audio?.rate === 48000 && p.audio?.layout === "stereo",
      `${p.w}×${p.h} ${p.fps} fps, ${p.codec} ${p.profile}, ${p.pix}(${p.color}), ${p.audio?.codec} ${p.audio?.profile} ${p.audio?.rate} Hz ${p.audio?.layout}, ${(p.bytes / 1e6).toFixed(2)} MB (${(p.bytes / 1048576).toFixed(2)} MiB)`);
    if (f === T.file && aspect === "16x9") check("2 master size", p.bytes <= 45e6, `${(p.bytes / 1e6).toFixed(2)} MB ≤ 45 MB`);
    if (f === T.web) check("2 web size", p.bytes <= 9.4e6, `${(p.bytes / 1e6).toFixed(2)} MB ≤ 9.4 MB`);
    // 10: loudness
    const l = await loudness(f);
    check(`10 loudness ${name}`, Math.abs(l.I + 14) <= 1 && l.TP <= -1.0, `${l.I} LUFS integrated, ${l.TP} dBTP true peak, LRA ${l.LRA} LU`, l);
  }

  // the footage's metas
  const shotDir = path.join(here, "out", "shots", aspect);
  const metas = {};
  for (const [seg, s] of Object.entries(TL.SEGMENTS)) if (s.shot) metas[seg] = JSON.parse(readFileSync(path.join(shotDir, s.shot, "meta.json"), "utf8"));

  // 4: offline and read-only
  const network = Object.entries(metas).flatMap(([seg, m]) => m.network.map((r) => ({ seg, ...r })));
  const writes = network.filter((r) => r.method !== "GET" && r.method !== "OPTIONS");
  const unserved = network.filter((r) => !["fixture", "mock", "preflight"].includes(r.served));
  const problems = Object.entries(metas).flatMap(([seg, m]) => m.problems.map((p) => `${seg}: ${p}`));
  check("4 network", !unserved.length && writes.every((w) => w.served === "mock") && !problems.length,
    `${network.length} API requests, all answered locally (${network.filter((r) => r.served === "fixture").length} fixture, ${network.filter((r) => r.served === "mock").length} mock, ${network.filter((r) => r.served === "preflight").length} preflight); writes: ${writes.map((w) => `${w.method} ${w.path} (${w.served}${w.auth ? ", authorised" : ""})`).join(", ") || "none"}; capture problems: ${problems.length}`);
  const fx = readdirSync(path.join(here, "fixtures")).map((f) => [f, readFileSync(path.join(here, "fixtures", f), "utf8")]);
  const leaks = fx.filter(([, t]) => /[\w.+-]+@[\w-]+\.[\w.]+|eyJ[\w-]{10,}\.|"(password|passwordHash|email|username|token)"\s*:/i.test(t)).map(([f]) => f);
  check("4 fixtures", !leaks.length, `${fx.length} fixture files; with an email, token or user field: ${leaks.join(", ") || "none"}`);

  // 6: fonts in every capture
  const fontsBad = Object.entries(metas).filter(([, m]) => !m.fonts?.dela || !m.fonts?.archivo).map(([s]) => s);
  check("6 fonts (captures)", !fontsBad.length, `Dela Gothic One + Archivo loaded in all ${Object.keys(metas).length} shots${fontsBad.length ? `; missing in ${fontsBad}` : ""}`);

  // 7: house rules by grep
  const html = readFileSync(path.join(here, "reel.html"), "utf8");
  const forbidden = html.match(/createLinearGradient|createRadialGradient|shadowBlur|filter|roundRect/g) ?? [];
  check("7 grep reel.html", !forbidden.length, `createLinearGradient|createRadialGradient|shadowBlur|filter|roundRect: ${forbidden.length} matches`);

  // 9: sync, press by press, from the metas against the score's own cue list
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/reel.html?aspect=${aspect}`;
  const { browser, pages, info } = await openPages(1, url, T);
  const page = pages[0];
  try {
    check("6 fonts (compositor)", info.fonts.dela && info.fonts.archivo, `compositor: ${JSON.stringify(info.fonts)}`);
    // 3: determinism of the compositor (the same 6 frames, twice, in a fresh page each time), before anything reads pixels back
    const times = [1.9, 9.5, 13.0, 25.95, 36.2, 43.6];
    const dir = path.join(here, "out", "verify", aspect);
    await fs.mkdir(dir, { recursive: true });
    for (const t of times) await frame(page, Math.round(t * FPS), path.join(dir, `a-${t}.jpg`));
    await page.reload();
    await page.waitForFunction(() => window.__ready === true);
    for (const t of [...times].reverse()) await frame(page, Math.round(t * FPS), path.join(dir, `b-${t}.jpg`));
    const same = await Promise.all(times.map(async (t) => (await fs.readFile(path.join(dir, `a-${t}.jpg`))).equals(await fs.readFile(path.join(dir, `b-${t}.jpg`)))));
    check("3 render determinism", same.every(Boolean), `frames at ${times.join(", ")} s rendered twice (fresh page, reverse order): ${same.map((x) => (x ? "identical" : "DIFFERENT")).join(", ")}`);

    await page.evaluate(() => window.renderAudio());
    const score = await page.evaluate(() => window.__score);
    const pressTimes = [];
    for (const [seg, m] of Object.entries(metas)) {
      const from = TL.SEGMENTS[seg].from, to = TL.SEGMENTS[seg].to;
      for (const p of m.presses) {
        const reel = p.down + from;
        if (reel >= from - 1e-6 && reel <= to + 1e-6) pressTimes.push({ seg, reel });
      }
      for (const d of m.drags) pressTimes.push({ seg, reel: d.at + from, drag: true });
    }
    const pressMiss = pressTimes.map((p) => ({ ...p, off: Math.min(...score.cues.presses.map((c) => Math.abs(c - p.reel))) })).filter((p) => p.off > frameS + 1e-6);
    check("9 press ticks", !pressMiss.length, `${pressTimes.length} presses in the metas, each with a tick within ±1 frame (max offset ${Math.max(0, ...pressTimes.map((p) => Math.min(...score.cues.presses.map((c) => Math.abs(c - p.reel))))).toFixed(4)} s)`, pressMiss);
    // whooshes: the designed gain peaks at the curve's fastest point; the rush is cover = 0.55
    let peakU = 0, best = 0;
    for (let i = 1; i < 4000; i++) {
      const r = coverRate(i / 4000);
      if (r > best) { best = r; peakU = i / 4000; }
    }
    const wipes = [...TL.CUTS.filter((c) => c.kind !== "deal").map((c) => [c.id, c.at, c.dur]), ...TL.APP_WIPES.map((w, i) => [`app${i}`, w[0], w[1]])];
    const whooshOff = wipes.map(([id, at, dur]) => {
      const w = score.cues.whooshes.find((x) => Math.abs(x.start - at) < 1e-6 && Math.abs(x.dur - dur) < 1e-6);
      return { id, rush: at + TL.RUSH * dur, peak: w ? w.start + peakU * w.dur : null };
    });
    const worst = Math.max(...whooshOff.map((w) => (w.peak === null ? Infinity : Math.abs(w.peak - w.rush))));
    check("9 whoosh peaks", worst <= 2 * frameS + 1e-6, `${whooshOff.length} wipes/irises; whoosh gain peaks at u = ${peakU.toFixed(3)} (cover ${cover(peakU).toFixed(2)}), the rush at u = ${TL.RUSH}: worst offset ${(worst * 1000).toFixed(1)} ms (±2 frames = ${(2 * frameS * 1000).toFixed(1)} ms)`);
    // the wheel: the score's ratchet against the captured spin (start mark and landing)
    const s = metas.S;
    const spinStart = (s.marks.spinStart ?? NaN) + TL.SEGMENTS.S.from;
    const pulses = crossings(s.marks.landing?.rotation ?? landingRotation(1, 6, 4), s.marks.landing?.count ?? 6).map((c) => spinStart + c.time / 1000);
    const ratchetOff = Math.max(...pulses.map((p) => Math.min(...score.cues.ratchet.map((c) => Math.abs(c - p)))));
    check("9 wheel ratchet", score.cues.ratchet.length === pulses.length && ratchetOff <= frameS, `${pulses.length} pulses (captured spin from ${spinStart.toFixed(3)} s, ${s.marks.landing?.rotation}° over ${s.marks.landing?.count} dishes, landed ${s.marks.landing?.offMarkerDeg}° off the marker), ${score.cues.ratchet.length} ticks, worst offset ${(ratchetOff * 1000).toFixed(2)} ms`);
    check("10 score (WAV)", Math.abs(score.lufs + 14) < 0.2, `score.js: ${score.lufs} LUFS, sample peak ${score.samplePeakDb} dBFS (normalisation gain ${score.gainDb} dB)`);

    // 7: drawn pixels are tokens or exact blends of tokens
    const auditTimes = aspect === "16x9" ? [0.3, 0.9, 1.25, 2.0, 5.4, 18.0, 18.3, 26.0, 28.5, 41.0, 42.5, 43.6] : [0.3, 1.25, 5.0, 18.0, 19.5, 24.0, 29.0, 32.0, 42.5, 43.6];
    const audits = [];
    for (const t of auditTimes) audits.push(await page.evaluate((x) => window.overlayAudit(x), t));
    const others = audits.reduce((n, a) => n + a.other, 0), total = audits.reduce((n, a) => n + a.token + a.blend + a.other, 0);
    check("7 overlay colours", others / Math.max(1, total) < 1e-4, `${total} opaque drawn pixels sampled at ${auditTimes.length} times: ${audits.reduce((n, a) => n + a.token, 0)} token, ${audits.reduce((n, a) => n + a.blend, 0)} exact blends of two tokens, ${others} other (${audits.reduce((n, a) => n + a.photo, 0)} photo pixels and ${audits.reduce((n, a) => n + a.fringe, 0)} faint edge pixels set aside)`, audits.filter((a) => a.other).map((a) => ({ T: a.T, other: a.other, samples: a.samples })));
    const holes = await page.evaluate(() => window.dealHoles());
    check("7 deal coverage", holes.every((h) => h.holes === 0), `ticket deal at the swap: ${holes.map((h) => `${h.T}s → ${h.holes} holes`).join(", ")}`);

  } finally {
    await browser.close();
    server.close();
  }

  const shotId = value("--determinism-shot");
  if (shotId) {
    const a = JSON.parse(readFileSync(path.join(here, "out", "debug", `${shotId}-meta-run1.json`), "utf8"));
    const b = JSON.parse(readFileSync(path.join(shotDir, shotId, "meta.json"), "utf8"));
    const anchors = (m) => JSON.stringify(m.frames.map((f) => f.a ?? null));
    const pointer = (m) => JSON.stringify(m.frames.map((f) => f.m));
    check(`3 capture determinism (${shotId})`, anchors(a) === anchors(b) && pointer(a) === pointer(b), `two captures of shot ${shotId}: anchors ${anchors(a) === anchors(b) ? "identical" : "DIFFERENT"} over ${a.frames.length} subframes, pointer path ${pointer(a) === pointer(b) ? "identical" : "DIFFERENT"}`);
  }

  await fs.writeFile(path.join(here, "out", `verify-${aspect}.json`), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks pass (${aspect})`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
