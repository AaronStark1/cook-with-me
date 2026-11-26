/* global OfflineAudioContext, btoa -- a browser module, imported by reel.html */
/**
 * The reel's score, synthesised offline (OfflineAudioContext, 48 kHz stereo, a fixed seed), so it is
 * identical on every render: 45 s at 120 BPM in F major, F – Dm – Gm – C, a chord a bar. Warm and
 * kitchen-percussive: a soft sine kick, rim/clave on 2 and 4, swung sixteenth shakers, a round
 * sine + triangle bass, FM electric-piano stabs on the off-beats, marimba plucks, and a filtered-saw
 * pad only under the Assembly orbit and the end card.
 *
 * Every sound effect sits on a picture event, and every event time comes from timeline.mjs (with the
 * app's own maths from lib/cover.js): whooshes whose gain follows the derivative of the wipe curve
 * (so they swell exactly in each wipe's rush), plate clinks on irises and landings, wooden knocks on
 * platter slot crossings and Cook Mode presses, a paper flick per ticket, stamp thumps for SAVED and
 * DONE, odometer and count-up ticks computed from the real values, a ratchet tick at each of the
 * wheel's crossings, a sizzle bed under Cook Mode only, and a soft tick on every press. No timer bell:
 * the app has no timers.
 *
 * renderScore() resolves to a base64 16-bit stereo WAV at 48 kHz, normalised to −14 LUFS integrated
 * (ITU-R BS.1770, measured here) under a −2 dBFS brickwall, faded to silence by 45.0 s.
 */
import * as TL from "../timeline.mjs";
import { cover, coverRate, crossings, landingRotation, invertEasing, easeArrive, easeWheel, SPIN_MS } from "./cover.js";

const SR = 48000;
const LEN = TL.DURATION;
const BEAT = TL.BEAT;
const BAR = TL.BAR;
const TARGET_LUFS = -14;
const CEILING_DB = -2.5;

// F major: F – Dm – Gm – C (a chord a bar), voicings around middle C
const N = (semitonesFromA4) => 440 * Math.pow(2, semitonesFromA4 / 12);
const CHORDS = {
  F: { root: N(-28), fifth: N(-21), keys: [N(-4), N(0), N(3), N(7)], pad: [N(-16), N(-9), N(-4), N(0)], arp: [N(-4), N(0), N(3), N(8), N(12)] },
  Dm: { root: N(-31), fifth: N(-24), keys: [N(-7), N(-4), N(0), N(5)], pad: [N(-19), N(-12), N(-7), N(-4)], arp: [N(-7), N(-4), N(0), N(5), N(8)] },
  Gm: { root: N(-26), fifth: N(-19), keys: [N(-2), N(1), N(5), N(10)], pad: [N(-14), N(-7), N(-2), N(1)], arp: [N(-2), N(1), N(5), N(10), N(13)] },
  C: { root: N(-33), fifth: N(-26), keys: [N(-5), N(-2), N(3), N(7)], pad: [N(-21), N(-14), N(-9), N(-5)], arp: [N(-9), N(-5), N(-2), N(3), N(7)] },
  Bb: { root: N(-35), fifth: N(-28), keys: [N(-7), N(-3), N(1), N(5)], pad: [N(-23), N(-16), N(-11), N(-7)], arp: [N(-11), N(-7), N(-3), N(1), N(5)] },
};
const PROGRESSION = ["F", "Dm", "Gm", "C"];
/** The last two bars resolve: Gm (40–42), C (42–44), then F on the final hit. */
const chordAt = (bar) => (bar === 20 ? "Gm" : bar === 21 ? "C" : bar >= 22 ? "F" : PROGRESSION[bar % 4]);

/** Every event the score places, for the sync checks (render.mjs / verify). */
export const CUES = { presses: [], whooshes: [], hits: [], clinks: [], knocks: [], ticks: [], thumps: [], flicks: [], ratchet: [] };

export async function renderScore() {
  for (const k of Object.keys(CUES)) CUES[k] = [];
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.round(SR * LEN), sampleRate: SR });
  let seed = 0x2c00c5;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

  const noise = ctx.createBuffer(2, SR * 4, SR);
  for (let c = 0; c < 2; c++) {
    const d = noise.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
  }

  // ── buses ──
  const master = ctx.createGain();
  master.gain.value = 0.7;
  const soft = ctx.createWaveShaper();
  const curve = new Float32Array(4096);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(1.2 * x) / Math.tanh(1.2);
  }
  soft.curve = curve;
  soft.oversample = "4x";
  master.connect(soft).connect(ctx.destination);

  // a small room: a 0.8 s noise impulse response with an early, fast decay
  const room = ctx.createConvolver();
  const ir = ctx.createBuffer(2, Math.round(SR * 0.8), SR);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / d.length, 2) * Math.exp(-i / (SR * 0.16));
  }
  room.buffer = ir;
  const roomOut = ctx.createGain();
  roomOut.gain.value = 0.22;
  room.connect(roomOut).connect(master);

  const music = ctx.createGain(); // keys, bass, pad, plucks: ducked under kicks and every effect
  music.connect(master);
  const drums = ctx.createGain();
  drums.gain.value = 0.95;
  drums.connect(master);
  const fx = ctx.createGain();
  fx.gain.value = 0.9;
  fx.connect(master);

  const send = (node, amount) => {
    const g = ctx.createGain();
    g.gain.value = amount;
    node.connect(g).connect(room);
  };
  const noiseAt = (t, dur, dest) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.connect(dest);
    s.start(Math.max(0, t), rnd() * 3, dur);
    return s;
  };
  const filter = (type, f, q = 0.7) => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  };
  const env = (t, attack, peak, decay, hold = 0) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, Math.max(0, t));
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (hold) g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.setTargetAtTime(0, t + attack + hold, decay);
    return g;
  };
  const panner = (p) => {
    const s = ctx.createStereoPanner();
    s.pan.value = Math.max(-1, Math.min(1, p));
    return s;
  };
  const sfxTimes = [];
  const kicks = [];

  // ── instruments ──
  function kick(t, v = 1) {
    kicks.push(t);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(118, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
    o.connect(env(t, 0.003, 0.9 * v, 0.09)).connect(drums);
    o.start(t);
    o.stop(t + 0.8);
    const hp = filter("highpass", 2500);
    noiseAt(t, 0.01, hp);
    hp.connect(env(t, 0.0005, 0.05 * v, 0.003)).connect(drums);
  }
  function rim(t, v = 1) {
    // a clave: a bright, short wooden tone and a band-passed click
    const o = ctx.createOscillator();
    o.frequency.value = 2400;
    const p = panner(0.18);
    o.connect(env(t, 0.001, 0.12 * v, 0.018)).connect(p).connect(drums);
    o.start(t);
    o.stop(t + 0.15);
    const bp = filter("bandpass", 1800, 2.2);
    noiseAt(t, 0.03, bp);
    const g = env(t, 0.0008, 0.22 * v, 0.012);
    bp.connect(g).connect(p);
    send(g, 0.25);
  }
  function shaker(t, v = 1) {
    const hp = filter("highpass", 6500);
    const p = panner((rnd() - 0.5) * 0.4 - 0.15);
    noiseAt(t, 0.07, hp);
    hp.connect(env(t, 0.006, 0.07 * v, 0.022)).connect(p).connect(drums);
  }
  function bass(t, f, dur, v = 1) {
    const lp = filter("lowpass", 900, 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32 * v, t + 0.008);
    g.gain.setTargetAtTime(0.14 * v, t + 0.008, 0.12);
    g.gain.setTargetAtTime(0, t + dur, 0.04);
    const s = ctx.createOscillator();
    s.frequency.value = f;
    const tri = ctx.createOscillator();
    tri.type = "triangle";
    tri.frequency.value = f;
    const tg = ctx.createGain();
    tg.gain.value = 0.45;
    s.connect(lp);
    tri.connect(tg).connect(lp);
    lp.connect(g).connect(music);
    for (const o of [s, tri]) {
      o.start(t);
      o.stop(t + dur + 0.4);
    }
  }
  /** FM electric piano: sine carrier, a ratio-1 modulator whose index decays. */
  function ep(t, freqs, v = 1, dur = 0.9) {
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(music);
    send(out, 0.28);
    freqs.forEach((f, i) => {
      const car = ctx.createOscillator();
      car.frequency.value = f;
      const mod = ctx.createOscillator();
      mod.frequency.value = f;
      const index = ctx.createGain();
      index.gain.setValueAtTime(f * 2.2, t);
      index.gain.setTargetAtTime(f * 0.25, t, 0.08);
      mod.connect(index).connect(car.frequency);
      const p = panner((i - (freqs.length - 1) / 2) * 0.16);
      car.connect(env(t, 0.004, (0.05 / Math.sqrt(freqs.length)) * v, dur * 0.35)).connect(p).connect(out);
      for (const o of [car, mod]) {
        o.start(t);
        o.stop(t + dur * 2.5);
      }
    });
  }
  function marimba(t, f, v = 1, pan = 0) {
    const p = panner(pan);
    const o1 = ctx.createOscillator();
    o1.frequency.value = f;
    const o4 = ctx.createOscillator();
    o4.frequency.value = f * 4;
    const g = ctx.createGain();
    g.connect(p).connect(music);
    send(g, 0.2);
    o1.connect(env(t, 0.002, 0.11 * v, 0.12)).connect(g);
    o4.connect(env(t, 0.001, 0.03 * v, 0.025)).connect(g);
    for (const o of [o1, o4]) {
      o.start(t);
      o.stop(t + 0.9);
    }
  }
  function pad(t0, t1, freqs, v = 1) {
    const lp = filter("lowpass", 700, 0.9);
    lp.frequency.setValueAtTime(500, t0);
    lp.frequency.linearRampToValueAtTime(1300, (t0 + t1) / 2);
    lp.frequency.linearRampToValueAtTime(800, t1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.03 * v, t0 + 0.9);
    g.gain.setValueAtTime(0.03 * v, Math.max(t0 + 0.9, t1 - 0.5));
    g.gain.linearRampToValueAtTime(0, t1);
    freqs.forEach((f, i) => {
      for (const detune of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = detune + i;
        const p = panner((detune < 0 ? -0.3 : 0.3) * (i % 2 ? 1 : 0.6));
        o.connect(p).connect(lp);
        o.start(t0);
        o.stop(t1 + 0.1);
      }
    });
    lp.connect(g).connect(music);
    send(g, 0.5);
  }

  // ── sound design ──
  /** A whoosh shaped by the wipe itself: gain ∝ d cover/du, centre frequency follows cover, pan follows the edge. */
  function whoosh(t0, dur, dir = 1, v = 1) {
    const n = 160;
    const gain = new Float32Array(n), freq = new Float32Array(n), pan = new Float32Array(n);
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, coverRate(i / (n - 1)));
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      gain[i] = (0.2 * v * coverRate(u)) / peak;
      freq[i] = 300 + 3400 * cover(u);
      pan[i] = 0.7 * dir * (1 - 2 * cover(u));
    }
    const bp = filter("bandpass", 600, 1.1);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueCurveAtTime(gain, t0, dur);
    bp.frequency.setValueCurveAtTime(freq, t0, dur);
    const p = ctx.createStereoPanner();
    p.pan.setValueCurveAtTime(pan, t0, dur);
    noiseAt(t0, dur + 0.05, bp);
    bp.connect(g).connect(p).connect(fx);
    send(g, 0.3);
    CUES.whooshes.push({ start: t0, dur, peak: t0 + dur * TL.RUSH });
    sfxTimes.push(t0 + dur * TL.RUSH);
  }
  /** Inharmonic plate partials (≈ 1, 2.76, 5.40, 8.93 × 1.9 kHz). */
  function clink(t, v = 1, pan = 0) {
    const p = panner(pan);
    [[1, 1, 0.6], [2.76, 0.5, 0.3], [5.4, 0.28, 0.15], [8.93, 0.12, 0.08]].forEach(([ratio, gain, decay]) => {
      const o = ctx.createOscillator();
      o.frequency.value = 1900 * ratio;
      const g = env(t, 0.0015, 0.055 * gain * v, decay / 3);
      o.connect(g).connect(p);
      o.start(t);
      o.stop(t + decay * 3);
    });
    p.connect(fx);
    send(p, 0.35);
    CUES.clinks.push(t);
    sfxTimes.push(t);
  }
  /** Wooden knock: 180 + 420 Hz with a 40 ms decay, plus a click. */
  function knock(t, v = 1, pan = 0) {
    const p = panner(pan);
    for (const [f, a] of [[180, 0.32], [420, 0.18]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(env(t, 0.001, a * v, 0.013)).connect(p);
      o.start(t);
      o.stop(t + 0.25);
    }
    const bp = filter("bandpass", 2200, 1.5);
    noiseAt(t, 0.012, bp);
    bp.connect(env(t, 0.0004, 0.12 * v, 0.003)).connect(p);
    p.connect(fx);
    send(p, 0.15);
    CUES.knocks.push(t);
    sfxTimes.push(t);
  }
  /** Paper flick: 25 ms of high-passed noise, panned to the ticket. */
  function flick(t, v = 1, pan = 0) {
    const hp = filter("highpass", 3200, 0.8);
    noiseAt(t, 0.03, hp);
    hp.connect(env(t, 0.001, 0.075 * v, 0.008)).connect(panner(pan)).connect(fx);
    CUES.flicks.push(t);
  }
  /** Stamp thump: a sine drop through 90 Hz and a low-passed slap. */
  function thump(t, v = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.14);
    o.connect(env(t, 0.002, 0.55 * v, 0.07)).connect(fx);
    o.start(t);
    o.stop(t + 0.6);
    const lp = filter("lowpass", 900, 0.7);
    noiseAt(t, 0.05, lp);
    const g = env(t, 0.001, 0.28 * v, 0.014);
    lp.connect(g).connect(fx);
    send(g, 0.3);
    CUES.thumps.push(t);
    sfxTimes.push(t);
  }
  function tick(t, f = 3000, v = 1, pan = 0, list = CUES.ticks) {
    const p = panner(pan);
    const o = ctx.createOscillator();
    o.frequency.value = f;
    o.connect(env(t, 0.0006, 0.045 * v, 0.004)).connect(p);
    o.start(t);
    o.stop(t + 0.05);
    const hp = filter("highpass", 5000);
    noiseAt(t, 0.012, hp);
    hp.connect(env(t, 0.0003, 0.03 * v, 0.002)).connect(p);
    p.connect(fx);
    list.push(t);
  }
  function hit(t, v = 1, tail = 0.35) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    o.connect(env(t, 0.004, 0.62 * v, tail)).connect(drums);
    o.start(t);
    o.stop(t + tail * 6);
    const lp = filter("lowpass", 1600, 0.7);
    noiseAt(t, 0.5, lp);
    const g = env(t, 0.002, 0.22 * v, 0.08);
    lp.connect(g).connect(fx);
    send(g, 0.6);
    kicks.push(t);
    CUES.hits.push(t);
    sfxTimes.push(t);
  }
  function riser(t, dur, v = 1) {
    const bp = filter("bandpass", 300, 2);
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(5500, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09 * v, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.04);
    noiseAt(t, dur + 0.06, bp);
    bp.connect(g).connect(fx);
    send(g, 0.3);
  }
  function sizzle(t0, t1, v = 1) {
    const bp = filter("bandpass", 4500, 0.6);
    const hp = filter("highpass", 3000, 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.03 * v, t0 + 0.5);
    g.gain.setValueAtTime(0.03 * v, t1 - 0.5);
    g.gain.linearRampToValueAtTime(0, t1);
    for (let t = t0; t < t1; t += 3.5) noiseAt(t, Math.min(3.6, t1 - t + 0.05), bp);
    bp.connect(hp).connect(g).connect(panner(-0.1)).connect(fx);
    // sparse crackle
    for (let t = t0 + 0.2; t < t1 - 0.2; t += 0.05 + rnd() * 0.22) tick(t, 3500 + rnd() * 2500, 0.18 + rnd() * 0.2, (rnd() - 0.5) * 0.8, []);
  }

  // ── the music ──
  const sections = (t) => ({
    intro: t < 2,
    groove: (t >= 2 && t < 9.5) || (t >= 37.4 && t < 40),
    thin: t >= 9.5 && t < 18,
    full: t >= 18 && t < 27,
    half: t >= 27 && t < 37.4,
    end: t >= 40,
  });
  for (let bar = 0; bar < 22; bar++) {
    const t0 = bar * BAR;
    const ch = CHORDS[chordAt(bar)];
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * BEAT;
      const s = sections(t);
      // drums
      if (s.groove || s.full) {
        if (b === 0 || b === 2) kick(t, b === 0 ? 1 : 0.85);
        if (b === 1 || b === 3) rim(t, 0.9);
        if (s.full && b === 3) kick(t + BEAT / 2, 0.55);
      }
      if (s.half) {
        if (b === 0) kick(t, 0.95);
        if (b === 2) rim(t, 1);
      }
      if (s.groove || s.full || s.half || s.thin) {
        // swung sixteenths: the 2nd and 4th of each beat land late
        for (let k = 0; k < 4; k++) {
          const tt = t + k * (BEAT / 4) + (k % 2 ? 0.028 : 0);
          if (s.thin && t < TL.T.asmPhases.converge && k % 2) continue;
          shaker(tt, (k === 0 ? 0.9 : k === 2 ? 0.7 : 0.5) * (s.half ? 0.7 : 1));
        }
      }
      // bass: root–fifth
      if (s.groove || s.full || (s.thin && t >= 16)) {
        bass(t, b % 2 ? ch.fifth : ch.root, 0.36, 0.95);
        if (s.full) bass(t + BEAT / 2 + 0.02, ch.root * 2, 0.16, 0.5);
      }
      if (s.half && (b === 0 || b === 2)) bass(t, b ? ch.fifth : ch.root, 0.8, 0.9);
      // keys: FM stabs on the off-beats
      if (s.intro || s.groove || s.full || s.half) ep(t + BEAT / 2, ch.keys, s.intro ? 0.8 : s.half ? 0.85 : 1, s.half ? 1.2 : 0.7);
    }
    // marimba: sparse plucks in the thin section, an arpeggio through browse and spin
    if (sections(t0).thin) {
      // eighth-note marimba through the Assembly, building in weight into the join at 13.00
      for (let k = 0; k < 8; k++) {
        const t = t0 + k * (BAR / 8);
        const build = t < TL.T.asmJoin ? 0.5 + 0.45 * prog(t, 9.5, TL.T.asmJoin) : 0.62;
        marimba(t, ch.arp[[0, 2, 4, 2, 1, 3, 4, 3][k]], build, k % 2 ? 0.25 : -0.25);
      }
    }
    if (sections(t0).full) {
      for (let k = 0; k < 16; k++) marimba(t0 + k * (BAR / 16) + (k % 2 ? 0.02 : 0), ch.arp[[0, 2, 1, 3, 2, 4, 3, 2][k % 8]], k % 4 === 0 ? 0.75 : 0.5, (k % 4) * 0.12 - 0.18);
    }
  }
  // the pad: under the Assembly orbit (and the build to it), and under the end card
  pad(TL.T.asmPhases.orbit - 0.5, TL.T.asmPhases.hold + 0.4, CHORDS.Gm.pad, 1.2);
  pad(40, 44.9, CHORDS.Gm.pad, 1.1);
  // the ending: keys + pad resolve over Gm → C, the final hit lands on F
  ep(40.0, CHORDS.Gm.keys, 0.9, 1.6);
  ep(41.0, CHORDS.Gm.keys, 0.6, 1.2);
  ep(42.0, CHORDS.C.keys, 0.9, 1.6);
  ep(43.0, CHORDS.C.keys, 0.65, 1.2);
  ep(TL.T.finalHit, CHORDS.F.keys.concat([CHORDS.F.keys[0] * 2]), 1.1, 2.2);
  bass(TL.T.finalHit, CHORDS.F.root, 0.9, 1);

  // ── picture events ──
  const presses = [];
  for (const [seg, list] of Object.entries(TL.CLICKS)) for (const up of list) presses.push({ seg, down: up - TL.PRESS_S, up });
  for (const [seg, list] of Object.entries(TL.HOLDS)) for (const down of list) presses.push({ seg, down, up: null });
  for (const [seg, list] of Object.entries(TL.DRAGS)) for (const d of list) presses.push({ seg, down: d.at, up: d.at + d.dur, drag: true });
  for (const p of presses) {
    tick(p.down, 3200, 0.9, 0, CUES.presses);
    sfxTimes.push(p.down);
  }

  // TITLE: a soft hit, a knock per word, the plate clink at the iris
  hit(0.0, 0.55, 0.3);
  ep(0.0, CHORDS.F.keys, 0.9, 1.2);
  TL.TITLE.line1.forEach((_, i) => knock(TL.T.titleWords + i * 0.07, 0.55, -0.3));
  knock(TL.T.titleDinner, 0.6, -0.3);
  clink(TL.T.titleIris[0] + TL.RUSH * (TL.T.titleIris[1] - TL.T.titleIris[0]), 0.9, 0.35);

  // the cuts: a whoosh per wipe, a clink at each plate iris, a hit on every cut
  for (const c of TL.CUTS) {
    if (c.kind === "wipe") whoosh(c.at, c.dur, c.dir, c.b === "broth" ? 0.45 : 1);
    if (c.kind === "iris") {
      whoosh(c.at, c.dur, 1, 0.55);
      clink(c.at + TL.RUSH * c.dur, 1, 0);
    }
    if (c.kind === "platter") {
      whoosh(c.at, c.dur, 1, 0.8);
      knock(c.at + invertEasing(easeWheel, 0.5) * c.dur, 0.9, 0);
    }
    const beat = c.kind === "deal" ? c.cover : Math.round((c.at + TL.RUSH * c.dur) / BEAT) * BEAT;
    if (c.b !== "broth") hit(beat, c.id === "T1" || c.id === "T3" || c.id === "T7" ? 1 : 0.6);
  }

  // H: the in-app wipes and the platter's slot crossings (Next turns one slot on the wheel's own curve; the drag crosses half a slot by hand)
  for (const [start, dur, dir] of TL.APP_WIPES) whoosh(start, dur, dir, 0.8);
  knock(TL.T.heroNext + invertEasing(easeWheel, 0.5) * TL.D_HERO, 0.9, 0.2);
  {
    const d = TL.T.heroDrag;
    const reach = d.frac / 0.5; // slots dragged
    const u = 1 - Math.cbrt(1 - 0.5 / reach); // the drag eases out: 1 − (1 − u)³
    knock(d.at + u * d.dur, 0.9, 0.3);
  }
  riser(TL.T.heroCursorOut[0], 0.9, 0.9);
  // E: Previous turns the platter back one slot
  knock(TL.T.endPrevious + invertEasing(easeWheel, 0.5) * TL.D_HERO, 0.7, -0.2);

  // A: a paper flick per ticket (panned by where it enters), a whoosh on converge, the join, the iris
  {
    const P = TL.T.asmPhases;
    for (let i = 0; i < TL.T.asmTickets + 1; i++) {
      const edge = i % 4;
      const along = 0.12 + ((i * 0.618034) % 1) * 0.76;
      const x = [-0.22, along, 1.22, along][edge];
      flick(P.gather + i * 0.12, 0.9, Math.max(-0.9, Math.min(0.9, (x - 0.5) * 1.6)));
    }
    whoosh(P.converge, P.build - P.converge, 1, 0.5);
    hit(TL.T.asmJoin, 0.9, 0.3);
    for (let k = 0; k < 8; k++) tick(TL.T.asmJoin + 0.012 + k * 0.022, 2600 + k * 160, 0.7, Math.cos((k * Math.PI) / 4) * 0.6);
    clink(TL.T.asmIris[0] + TL.RUSH * (TL.T.asmIris[1] - TL.T.asmIris[0]), 0.9, 0.1);
    riser(P.converge, P.build - P.converge, 0.7);
  }

  // T3: a flick per ticket in and out
  {
    const c = TL.CUTS.find((x) => x.kind === "deal");
    const n = 12;
    for (let i = 0; i < n; i++) {
      const along = 0.12 + ((i * 0.618034) % 1) * 0.76;
      const xin = [-0.2, along, 1.2, along][i % 4], xout = [1.2, 1 - along, -0.2, 1 - along][i % 4];
      flick(c.at + i * 0.04, 0.8, (xin - 0.5) * 1.6);
      flick(c.cover + i * 0.03, 0.6, (xout - 0.5) * 1.6);
    }
  }

  // I: the odometer rolls 30 → 06 on the Italian filter (one tick per digit change, on the app's 620 ms ease-arrive)
  const odometer = (t, from, to, pad) => {
    const a = String(from).padStart(pad, "0").split("").map(Number);
    const b = String(to).padStart(pad, "0").split("").map(Number);
    a.forEach((d0, col) => {
      const d1 = b[col];
      if (d0 === d1) return;
      const steps = Math.abs(d1 - d0);
      for (let k = 1; k <= steps; k++) {
        const p = (k - 0.5) / steps;
        tick(t + invertEasing(easeArrive, p) * 0.62, 2200 + col * 500 + k * 40, 0.55, col ? 0.25 : -0.25);
      }
    });
  };
  odometer(TL.T.italian, 30, 6, 2);
  whoosh(TL.T.indexScroll[0], TL.T.indexScroll[1] - TL.T.indexScroll[0], -1, 0.35);

  // S: the wheel's ratchet at the app's own crossing times, slowing in pitch; a chord and a clink when it stops
  {
    const total = landingRotation(1, 6, 4);
    for (const { time } of crossings(total, 6)) {
      const t = TL.T.spinStart + time / 1000;
      const u = time / SPIN_MS;
      tick(t, 3400 - 1600 * u, 0.75 - 0.25 * u, 0.15, CUES.ratchet);
    }
    const stop = TL.T.spinStart + SPIN_MS / 1000;
    clink(stop, 1, 0);
    ep(stop, CHORDS.F.keys.concat([CHORDS.F.keys[1] * 2]), 1.2, 1.4);
    flick(TL.T.resultCard, 0.6, -0.3);
  }

  // D: the facts count up (prep 20, cook 15, serves 4, kcal 300: 900 ms each, 80 ms apart, from the page's first frame)
  {
    const start = SEGMENTS_FROM("DC");
    [[20, 0], [15, 0.08], [4, 0.16], [300, 0.24]].forEach(([target, delay], col) => {
      let last = 0, count = 0;
      const step = Math.ceil(target / 12); // at most about 12 ticks per count
      for (let ms = 0; ms <= 900; ms += 1000 / 180) {
        const k = ms / 900;
        const value = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (value >= last + step || (value === target && last !== target)) {
          tick(start + delay + ms / 1000, 2400 + col * 300, 0.35, -0.4 + col * 0.25);
          last = value;
          if (++count > 12) break;
        }
      }
    });
  }
  // SAVED and DONE: the stamps slam (the save lands on its release; DONE slams as the finish wipe rushes)
  thump(TL.T.save + 1 / 180, 1);
  thump(TL.T.finish + TL.RUSH * TL.D_STEP, 1);
  ep(TL.T.finish + TL.RUSH * TL.D_STEP, CHORDS.C.keys, 1.1, 1.4);
  // Cook Mode: a knock on every press inside it, a tick for each check-off, the sizzle bed under it all
  for (const t of [TL.T.startCooking, TL.T.cookNext1, TL.T.cookNext2, TL.T.ingredients, TL.T.finish]) knock(t - TL.PRESS_S, 0.75, 0.1);
  for (const t of [TL.T.check1, TL.T.check2]) tick(t + 0.06, 4200, 0.8, -0.2);
  sizzle(TL.T.startCooking + 0.02, TL.CUTS.find((c) => c.kind === "platter").at + 0.3, 1);
  // E: the lockup arrives
  knock(TL.T.endWordmark, 0.5, -0.4);
  tick(TL.T.endKicker, 2600, 0.5, -0.4);
  tick(TL.T.endUrl, 2900, 0.5, -0.4);
  // the final hit
  hit(TL.T.finalHit, 1.1, 0.55);
  kick(TL.T.finalHit, 0.9);
  clink(TL.T.finalHit + 0.02, 0.7, 0);

  // ── the mix: the music bus ducks under every kick, and dips 4 dB for 120 ms under each effect ──
  const dips = [];
  for (const k of kicks) dips.push([k, 0.55, 0.11]);
  for (const s of sfxTimes) dips.push([s, 0.63, 0.12]);
  dips.sort((a, b) => a[0] - b[0]);
  music.gain.setValueAtTime(1, 0);
  for (const [t, depth, len] of dips) {
    music.gain.setValueAtTime(1, Math.max(0, t - 0.003));
    music.gain.linearRampToValueAtTime(depth, t + 0.01);
    music.gain.setTargetAtTime(1, t + 0.01, len / 2.5);
  }
  // silence by 45.0: the tail fades over the last 0.5 s, so the file loops clean
  master.gain.setValueAtTime(0.7, LEN - 0.85);
  master.gain.linearRampToValueAtTime(0, LEN - 0.05);

  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const stats = normalise(L, R);
  window.__score = { cues: CUES, ...stats };
  return toWav(L, R);
}

const SEGMENTS_FROM = (id) => TL.SEGMENTS[id].from;
const prog = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

// ── loudness: ITU-R BS.1770-4 integrated loudness (K-weighting, 400 ms blocks, gating) ──
function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}
function kWeight(x) {
  // the BS.1770 pre-filter (high shelf) and RLB high-pass, at 48 kHz
  const s = biquad(x, 1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585);
  return biquad(s, 1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621);
}
export function integratedLoudness(L, R) {
  const kl = kWeight(L), kr = kWeight(R);
  const block = Math.round(0.4 * SR), hop = Math.round(0.1 * SR);
  const powers = [];
  for (let s = 0; s + block <= kl.length; s += hop) {
    let sum = 0;
    for (let i = s; i < s + block; i++) sum += kl[i] * kl[i] + kr[i] * kr[i];
    powers.push(sum / block);
  }
  const lufs = (p) => -0.691 + 10 * Math.log10(p);
  const abs = powers.filter((p) => lufs(p) > -70);
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const rel = lufs(mean(abs)) - 10;
  const gated = abs.filter((p) => lufs(p) > rel);
  return lufs(mean(gated));
}
/** −14 LUFS under a −2 dBFS brickwall (2 ms look-ahead, 60 ms release), measured and applied in place. */
function normalise(L, R) {
  let gain = 1;
  let lufs = integratedLoudness(L, R);
  const ceiling = Math.pow(10, CEILING_DB / 20);
  for (let pass = 0; pass < 4; pass++) {
    const g = Math.pow(10, (TARGET_LUFS - lufs) / 20);
    gain *= g;
    for (let i = 0; i < L.length; i++) {
      L[i] *= g;
      R[i] *= g;
    }
    limit(L, R, ceiling);
    lufs = integratedLoudness(L, R);
    if (Math.abs(lufs - TARGET_LUFS) < 0.05) break;
  }
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  return { lufs: Math.round(lufs * 100) / 100, samplePeakDb: Math.round(20 * Math.log10(peak) * 100) / 100, gainDb: Math.round(20 * Math.log10(gain) * 100) / 100 };
}
function limit(L, R, ceiling) {
  const n = L.length;
  const look = Math.round(0.002 * SR), release = Math.exp(-1 / (0.06 * SR));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  // 1. the gain must already be down when a peak arrives: a forward-looking minimum over the look-ahead
  const g1 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = need[i];
    for (let k = 1; k <= look && i + k < n; k++) if (need[i + k] < m) m = need[i + k];
    g1[i] = m;
  }
  // 2. a moving average over the same window turns each step into a ramp and never exceeds the need at a peak
  let sum = 0;
  let env = 1;
  for (let i = 0; i < n; i++) {
    sum += g1[i];
    if (i >= look) sum -= g1[i - look];
    const g2 = sum / Math.min(i + 1, look);
    // 3. recover slowly (60 ms release), drop at once
    env = Math.min(g2, 1 - (1 - env) * release);
    L[i] *= env;
    R[i] *= env;
  }
}
function toWav(L, R) {
  const frames = L.length, bytes = 44 + frames * 4;
  const dv = new DataView(new ArrayBuffer(bytes));
  const str = (o, s) => [...s].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  dv.setUint32(4, bytes - 8, true);
  str(8, "WAVE");
  str(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 2, true);
  dv.setUint32(24, SR, true);
  dv.setUint32(28, SR * 4, true);
  dv.setUint16(32, 4, true);
  dv.setUint16(34, 16, true);
  str(36, "data");
  dv.setUint32(40, frames * 4, true);
  for (let i = 0, o = 44; i < frames; i++, o += 4) {
    dv.setInt16(o, Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), true);
    dv.setInt16(o + 2, Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), true);
  }
  const u8 = new Uint8Array(dv.buffer);
  let bin = "";
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
