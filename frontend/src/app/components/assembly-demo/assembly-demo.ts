import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, computed, inject, input, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecipeModel } from '../../models/recipe-model';
import { recipeMeta } from '../../models/recipe-meta';
import { splitIngredient } from '../../models/ingredient';
import { Garnish } from '../garnish/garnish';
import { GarnishName } from '../garnish/garnish-glyphs';
import { garnishFor, matchGarnish } from '../garnish/garnish-pick';
import { Odometer } from '../odometer/odometer';
import { AssemblyPlate } from './assembly-plate';
import { fitGhostWord, measureWord } from '../../motion/ghost-fit';
import { fontsReady } from '../../motion/intro';
import { MotionPrefs } from '../../motion/motion-prefs';
import { ScrollState } from '../../motion/scroll-state';
import { EASE_ARRIVE, EASE_GLIDE, EASE_OUT_QUAD, WIPE_EASING } from '../../motion/tokens';
import { driftKeyframes, sweepKeyframes, wipeKeyframes } from '../../motion/wipe';
import {
  ANGLES, AssemblyDriver, AssemblyPhase, AssemblyTimeline, CAMERA, HANDOFF_MS, ITEM_MS, MAX_TICKETS, MAX_TICKETS_COMPACT, MAX_TILT, SCROLL_QUERY,
  Track, Vec, angleLabelAt, arcMid, at, driverFor, itemStart, locate, onCircle, phaseAt, ticketAngle, ticketEntry, ticketList,
  ticketTier, totalMs,
} from '../../motion/assembly-timeline';

/** Field colours for the three items (paprika, beet, basil) — the hero's own palette. */
const FIELDS = ['#B4410E', '#9B1B3C', '#2F5A2E', '#C8281C'] as const;

interface Ticket { name: string; quantity: string | null; glyph: GarnishName | null; more?: boolean }
interface Item {
  recipe: RecipeModel;
  color: string;
  word: string;
  /** Fitted size / letter-spacing for the ghost word (null until the display font is measurable). */
  ghost: Record<string, string> | null;
  meta: string[];
  tickets: Ticket[];
  /** Garnish stickers standing on the plate, always facing the camera. */
  billboards: GarnishName[];
}

/**
 * "Watch it come together" — a recipe's real ingredients fly in, converge on a
 * plate, the dish photo irises open and a simulated camera orbits it.
 *
 * Honesty: each recipe has ONE photograph. The "angles" are a camera move
 * around that single photo on a plate; no copy here claims otherwise.
 *
 * The natural, un-animated layout IS the finished state (assembled dish,
 * ingredient list, links). The timeline only ever animates *from* elsewhere to
 * that state, so reduced motion, a failed observer or a failed animation all
 * leave complete, usable content.
 */
@Component({
  selector: 'app-assembly-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Garnish, Odometer, AssemblyPlate],
  templateUrl: './assembly-demo.html',
  styleUrl: './assembly-demo.css',
})
export class AssemblyDemo {
  readonly recipes = input<RecipeModel[]>([]);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly prefs = inject(MotionPrefs);
  private readonly scroll = inject(ScrollState);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly angles = ANGLES;

  /** Compact = the stacked small-screen composition (≤ 820px), which shows fewer tickets. */
  protected readonly compact = signal(false);
  protected readonly driver = signal<AssemblyDriver>('static');
  private readonly fonts = signal(false);

  protected readonly items = computed<Item[]>(() => {
    const max = this.compact() ? MAX_TICKETS_COMPACT : MAX_TICKETS;
    return this.recipes().map((recipe, i) => {
      const { shown, more } = ticketList(recipe.ingredients, max);
      const tickets: Ticket[] = shown.map((line) => ({ ...splitIngredient(line), glyph: garnishFor(line) }));
      if (more) tickets.push({ name: `+${more} more`, quantity: null, glyph: null, more: true });
      const matched = matchGarnish(recipe.ingredients).filter((g) => g !== 'sesame' && g !== 'peppercorn');
      // the ghost word is the recipe's own name — its first one or two words when it is long
      const word = (recipe.name ?? '').trim().split(/\s+/).slice(0, (recipe.name ?? '').length > 14 ? 1 : 2).join(' ').toUpperCase();
      const metrics = this.fonts() && word ? measureWord(word, `'Dela Gothic One'`) : null;
      const fit = metrics ? fitGhostWord(metrics, this.compact() ? { width: 92, capTarget: 15 } : { width: 66, capTarget: 13 }) : null;
      return {
        recipe,
        color: FIELDS[i % FIELDS.length],
        word,
        ghost: fit ? { '--fs': `${fit.size.toFixed(3)}cqw`, '--ls': `${fit.spacing.toFixed(4)}em` } : null,
        meta: recipeMeta(recipe),
        tickets,
        billboards: [matched[0] ?? 'rosemary', matched[1] ?? 'peppercorn'],
      };
    });
  });

  protected readonly active = signal(0);
  /** Item being wiped away during a hand-off (shown above the incoming one), or null. */
  protected readonly leaving = signal<number | null>(null);
  protected readonly phase = signal<AssemblyPhase>('present');
  protected readonly angle = signal('Top-down');
  /** The plate can be turned by hand (end of an item, and always in the static view). */
  protected readonly explore = signal(true);
  protected readonly playing = signal(false);
  /** 0–100, the player scrubber's value. */
  protected readonly percent = signal(100);
  protected readonly phaseText = computed(() => at(this.phase()).label);
  /** Tickets float (bob, depth-of-field) only while they are in the air. */
  protected readonly floating = computed(() => !this.explore() && (this.phase() === 'gather' || this.phase() === 'converge'));
  protected readonly announcement = signal('');
  /** Section is on screen in a visible tab (idle loops and playback stop otherwise). */
  protected readonly idle = signal(false);

  private readonly timelines = new Map<number, AssemblyTimeline>();
  private handoff: AssemblyTimeline | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private played = false;
  private visible = false;
  private ex = 0;
  private ez = 0;
  private inertia = 0;

  constructor() {
    fontsReady(3000).then(() => this.fonts.set(true));
    afterNextRender(() => this.init());
    this.destroyRef.onDestroy(() => this.teardown());
  }

  // ---- setup --------------------------------------------------------------------
  private init() {
    const stage = this.stage();
    if (!stage) return;
    const canObserve = typeof IntersectionObserver !== 'undefined' && typeof stage.animate === 'function';
    const media = window.matchMedia?.(SCROLL_QUERY);
    const pick = () => {
      this.compact.set(stage.clientWidth <= 820);
      return driverFor({
        width: window.innerWidth,
        finePointer: !!window.matchMedia?.('(pointer: fine)').matches,
        reduced: this.prefs.reduced(),
        canObserve,
      });
    };
    this.zone.run(() => this.start(pick()));

    this.zone.runOutsideAngular(() => {
      const cleanups: Array<() => void> = [];
      // layout or motion preference changed: rebuild from scratch with the right driver
      const restart = () => this.zone.run(() => this.start(pick()));
      let width = stage.clientWidth;
      let height = stage.clientHeight;
      if (typeof ResizeObserver !== 'undefined') {
        const resize = new ResizeObserver(() => {
          if (Math.abs(stage.clientWidth - width) < 2 && Math.abs(stage.clientHeight - height) < 2) return;
          width = stage.clientWidth;
          height = stage.clientHeight;
          restart();
        });
        resize.observe(stage);
        cleanups.push(() => resize.disconnect());
      }
      media?.addEventListener?.('change', restart);
      cleanups.push(() => media?.removeEventListener?.('change', restart));

      if (canObserve) {
        const io = new IntersectionObserver(
          ([entry]) => {
            this.visible = entry.intersectionRatio >= 0.5;
            const idle = !entry.isIntersecting;
            if (idle !== this.idle()) this.zone.run(() => this.idle.set(idle));
            this.onVisibility();
          },
          { threshold: [0, 0.5] },
        );
        io.observe(stage);
        cleanups.push(() => io.disconnect());
      }
      const onTab = () => this.onVisibility();
      document.addEventListener('visibilitychange', onTab);
      cleanups.push(() => document.removeEventListener('visibilitychange', onTab));

      cleanups.push(this.scroll.onFrame(() => this.onScroll()));
      this.bindExplore(stage, cleanups);
      this.destroyRef.onDestroy(() => cleanups.forEach((fn) => fn()));
    });
  }

  private stage(): HTMLElement | null {
    return this.host.querySelector('.asm__stage');
  }

  private scene(index: number): HTMLElement | null {
    return this.host.querySelector(`[data-scene="${index}"]`);
  }

  /** (Re)start with a driver. The static driver builds nothing: the natural layout is the finished dish. */
  private start(driver: AssemblyDriver) {
    this.teardown();
    this.driver.set(driver);
    this.setExplore(0, 0);
    this.leaving.set(null);
    if (driver === 'static') {
      this.phase.set('present');
      this.explore.set(true);
      this.percent.set(100);
      return;
    }
    this.explore.set(false);
    this.phase.set('set');
    this.percent.set(0);
    // wait a frame so the tickets (which depend on `compact`) have rendered before they are measured
    requestAnimationFrame(() => {
      if (this.driver() !== driver) return;
      this.timeline(this.active())?.seek(0);
      if (driver === 'scroll') this.onScroll(true);
      else this.onVisibility();
    });
  }

  private teardown() {
    this.timelines.forEach((t) => t.destroy());
    this.timelines.clear();
    this.handoff?.destroy();
    this.handoff = null;
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    cancelAnimationFrame(this.inertia);
    this.playing.set(false);
  }

  // ---- building one scene's timeline ----------------------------------------------
  private timeline(index: number): AssemblyTimeline | null {
    const existing = this.timelines.get(index);
    if (existing) return existing;
    const scene = this.scene(index);
    const stage = this.stage();
    if (!scene || !stage) return null;
    const built = new AssemblyTimeline(this.tracks(scene, stage));
    this.timelines.set(index, built);
    return built;
  }

  private tracks(scene: HTMLElement, stage: HTMLElement): Track[] {
    const box = stage.getBoundingClientRect();
    const W = box.width;
    const H = box.height;
    const wipe = WIPE_EASING();
    const q = <T extends HTMLElement>(selector: string) => scene.querySelector<T>(selector);
    const qa = (selector: string) => Array.from(scene.querySelectorAll<HTMLElement>(selector));
    const centreOf = (el: Element): Vec => {
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
    };
    const plateEl = q('.asm__plate');
    const plateRect = plateEl?.getBoundingClientRect();
    const centre: Vec = plateEl ? centreOf(plateEl) : { x: W / 2, y: H / 2 };
    const R = (plateRect?.width ?? Math.min(W, H) * 0.4) / 2;
    const tracks: Track[] = [];
    const set = at('set'), gather = at('gather'), converge = at('converge'), build = at('build'), orbit = at('orbit'), present = at('present');

    // SET — the empty plate arrives (parallax .30) and the ghost word rises from its mask
    tracks.push({
      el: q('.asm__table'), from: set.from, duration: set.to - set.from, easing: EASE_ARRIVE,
      keyframes: [{ translate: `${0.3 * W}px 0px` }, { translate: '0px 0px' }],
    });
    tracks.push({
      el: q('.asm__ghost'), from: set.from, duration: set.to - set.from + 200, easing: EASE_ARRIVE,
      // `transform`, not `translate`: the word's own CSS translate (its centring) must survive the animation
      keyframes: [{ clipPath: 'inset(-10% -5% 100% -5%)', transform: 'translateY(100%)' }, { clipPath: 'inset(-10% -5% -10% -5%)', transform: 'translateY(0)' }],
    });

    // GATHER → CONVERGE → BUILD — each ticket is ONE animation: in along an arc, spiral to the rim, out to its list place
    const tickets = qa('.ticket');
    const count = tickets.length;
    tickets.forEach((ticket, i) => {
      const base = centreOf(ticket);
      const tier = ticketTier(i);
      const entry = ticketEntry(i);
      const angle = ticketAngle(i, count);
      const from: Vec = { x: entry.x * W, y: entry.y * H };
      const scatter = onCircle(centre, R * (1.5 + (tier.name === 'near' ? 0.32 : tier.name === 'mid' ? 0.12 : 0)), angle, Math.min(1, (H * 0.86) / (R * 3.7)));
      const dock = onCircle(centre, R * 0.9, angle);
      const mid1 = arcMid(from, scatter, i % 2 ? 0.22 : -0.22);
      const swirl = onCircle(centre, R * 1.25, angle - 50);
      const rest = ((i * 37) % 13) - 6; // −6°…+6°, deterministic
      const rel = (p: Vec, rotate: number, scale: number) =>
        `translate(${(p.x - base.x).toFixed(1)}px, ${(p.y - base.y).toFixed(1)}px) rotate(${rotate}deg) scale(${scale})`;
      const start = gather.from + i * 120;
      const settle = Math.min(gather.to - 150, start + 1150);
      const span = build.to - start;
      const k = (ms: number) => Math.min(1, Math.max(0, (ms - start) / span));
      // near tickets start further out (parallax .75), far ones closer (.40)
      const far: Vec = { x: scatter.x + (from.x - scatter.x) * (0.6 + tier.parallax * 0.55), y: scatter.y + (from.y - scatter.y) * (0.6 + tier.parallax * 0.55) };
      tracks.push({
        el: ticket, from: start, duration: span,
        keyframes: [
          { transform: rel(far, rest * 3, tier.scale), offset: 0, easing: EASE_OUT_QUAD },
          { transform: rel(mid1, rest * 2, tier.scale), offset: k(start + (settle - start) * 0.5), easing: EASE_ARRIVE },
          { transform: rel(scatter, rest, tier.scale), offset: k(settle), easing: 'linear' },
          { transform: rel(scatter, rest, tier.scale), offset: k(converge.from), easing: EASE_GLIDE },
          { transform: rel(swirl, rest * 0.4, 0.62), offset: k(converge.from + (converge.to - converge.from) * 0.55), easing: EASE_GLIDE },
          { transform: rel(dock, 0, 0.35), offset: k(converge.to), easing: EASE_ARRIVE },
          { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', offset: 1 },
        ],
      });
    });

    // the join: one hard burst of eight squares as the tickets dock
    qa('.asm__spark').forEach((spark, i) => {
      const a = (i * Math.PI) / 4;
      const reach = R * 1.15;
      tracks.push({
        el: spark, from: converge.to - 60, duration: 460, easing: EASE_ARRIVE, fill: 'none',
        keyframes: [
          { opacity: 1, translate: `${(Math.cos(a) * R * 0.5).toFixed(1)}px ${(Math.sin(a) * R * 0.5).toFixed(1)}px`, scale: 1 },
          { opacity: 0, translate: `${(Math.cos(a) * reach).toFixed(1)}px ${(Math.sin(a) * reach).toFixed(1)}px`, scale: 0.4 },
        ],
      });
    });

    // BUILD — the photo irises open behind a 6px yolk ring; the plate gains its thickness
    tracks.push({
      el: q('.asm__photo'), from: build.from, duration: 900, easing: wipe,
      keyframes: [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(50.5% at 50% 50%)' }],
    });
    tracks.push({
      el: q('.asm__iris'), from: build.from, duration: 900, easing: wipe, fill: 'none',
      keyframes: [{ opacity: 1, scale: 0 }, { opacity: 1, scale: 1 }],
    });
    qa('.asm__bb').forEach((bb, i) => {
      tracks.push({ el: bb, from: build.from + 700 + i * 90, duration: 320, easing: EASE_ARRIVE, keyframes: [{ scale: 0 }, { scale: 1 }] });
    });
    qa('.asm__slice').forEach((slice, i) => {
      // present (and extruded) only from Build to the end of the Orbit — i.e. only while the plate can be tilted
      tracks.push({
        el: slice, from: build.from, duration: orbit.to - build.from, fill: 'none',
        keyframes: [
          { opacity: 1, transform: 'translateZ(0px)', offset: 0, easing: EASE_ARRIVE },
          { opacity: 1, transform: `translateZ(${-(i + 1) * 1.6}px)`, offset: (build.to - build.from) / (orbit.to - build.from) },
          { opacity: 1, transform: `translateZ(${-(i + 1) * 1.6}px)`, offset: 1 },
        ],
      });
    });

    // ORBIT — the camera: tilt and turn through the stops; billboards do the exact inverse
    const stops = CAMERA.map((stop) => ({ ...stop, offset: stop.at, easing: EASE_GLIDE }));
    tracks.push({
      el: plateEl, from: orbit.from, duration: orbit.to - orbit.from,
      keyframes: stops.map((s) => ({ transform: `rotateX(${s.x}deg) rotateZ(${s.z}deg)`, offset: s.offset, easing: s.easing })),
    });
    qa('.asm__bb-orbit').forEach((bb) => {
      tracks.push({
        el: bb, from: orbit.from, duration: orbit.to - orbit.from,
        keyframes: stops.map((s) => ({ transform: `rotateZ(${-s.z}deg) rotateX(${-s.x}deg)`, offset: s.offset, easing: s.easing })),
      });
    });

    // PRESENT — name, tags and the two links rise, 80 ms apart
    qa('.asm__info > *').forEach((el, i) => {
      tracks.push({
        el, from: present.from + i * 80, duration: 620, easing: EASE_ARRIVE,
        keyframes: [{ opacity: 0, translate: '0px 16px' }, { opacity: 1, translate: '0px 0px' }],
      });
    });

    // the player's scrubber fill runs on the same clock
    tracks.push({ el: scene.parentElement?.querySelector('.asm__scrub-fill'), from: 0, duration: ITEM_MS, keyframes: [{ scale: '0 1' }, { scale: '1 1' }] });
    return tracks;
  }

  /** The §4.2 wipe that takes item `index` away: its colour panel slides off with the yolk edge, its content is clipped and drifts. */
  private handoffTimeline(index: number): AssemblyTimeline | null {
    const scene = this.scene(index);
    const stage = this.stage();
    if (!scene || !stage) return null;
    const easing = WIPE_EASING();
    return new AssemblyTimeline(
      [
        { el: scene.querySelector('.asm__field'), from: 0, duration: HANDOFF_MS, easing, keyframes: sweepKeyframes(1) },
        { el: scene.querySelector('.asm__content'), from: 0, duration: HANDOFF_MS, easing, keyframes: wipeKeyframes(1) },
        { el: scene.querySelector('.asm__drift'), from: 0, duration: HANDOFF_MS, easing, keyframes: driftKeyframes(1, stage.clientWidth) },
      ],
      HANDOFF_MS,
    );
  }

  // ---- scroll driver ---------------------------------------------------------------
  private lastKey = '';
  private onScroll(force = false) {
    if (this.driver() !== 'scroll') return;
    const rect = this.host.getBoundingClientRect();
    if (!force && (rect.bottom < 0 || rect.top > window.innerHeight)) return; // idle while off-screen
    const stage = this.stage();
    if (!stage) return;
    const top = parseFloat(getComputedStyle(stage).top) || 0;
    const travel = rect.height - stage.offsetHeight;
    const progress = travel > 0 ? Math.min(1, Math.max(0, (top - rect.top) / travel)) : 0;
    const count = this.items().length;
    const where = locate(progress * totalMs(count), count);

    // per-frame work: just the scrub (no Angular)
    this.timeline(where.item)?.seek(where.local);
    if (where.handoff !== null) {
      if (!this.handoff || this.handoffFor !== where.item) {
        this.handoff?.destroy();
        this.handoff = this.handoffTimeline(where.item);
        this.handoffFor = where.item;
        this.timeline(where.item + 1)?.seek(0);
      }
      this.handoff?.seek(where.handoff);
    } else if (this.handoff) {
      this.handoff.destroy();
      this.handoff = null;
      this.handoffFor = -1;
    }

    // template state: only when something a template reads has actually changed
    const phase = phaseAt(where.local);
    const angle = angleLabelAt(where.local);
    const key = `${where.item}|${phase}|${angle}|${where.hold}|${where.handoff !== null}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.zone.run(() => {
      this.active.set(where.item);
      this.leaving.set(null);
      this.next.set(where.handoff !== null ? where.item + 1 : null);
      this.phase.set(phase);
      this.angle.set(angle);
      if (this.explore() !== where.hold) {
        this.explore.set(where.hold);
        if (!where.hold) this.setExplore(0, 0);
      }
    });
  }
  private handoffFor = -1;
  /** Scroll hand-off: the incoming item, shown underneath the one being wiped away. */
  protected readonly next = signal<number | null>(null);

  // ---- player driver ---------------------------------------------------------------
  private onVisibility() {
    if (this.driver() !== 'player') return;
    const timeline = this.timelines.get(this.active());
    const shouldRun = this.visible && !document.hidden;
    if (!shouldRun) {
      if (timeline?.isPlaying) {
        timeline.pause();
        this.zone.run(() => this.playing.set(false));
        this.resumeOnReturn = true;
      }
      return;
    }
    // plays once, the first time at least half the stage is on screen — it never loops
    if (!this.played) {
      this.played = true;
      this.zone.run(() => this.play());
    } else if (this.resumeOnReturn) {
      this.resumeOnReturn = false;
      this.zone.run(() => this.play());
    }
  }
  private resumeOnReturn = false;

  protected play() {
    const timeline = this.timeline(this.active());
    if (!timeline) return;
    if (timeline.time >= ITEM_MS) timeline.seek(0);
    this.explore.set(false);
    this.setExplore(0, 0);
    timeline.play();
    this.playing.set(true);
    this.watch();
  }

  protected pause() {
    this.resumeOnReturn = false;
    this.timelines.get(this.active())?.pause();
    this.playing.set(false);
    this.sync();
  }

  protected toggle() {
    this.playing() ? this.pause() : this.play();
  }

  protected replay() {
    this.timeline(this.active())?.seek(0);
    this.play();
    this.say();
  }

  /** Scrubber: `fraction` 0–1 of the current item. */
  protected scrubTo(fraction: number) {
    const timeline = this.timeline(this.active());
    if (!timeline) return;
    this.resumeOnReturn = false;
    timeline.seek(Math.min(1, Math.max(0, fraction)) * ITEM_MS);
    this.playing.set(false);
    this.sync();
  }

  protected onScrubKey(event: KeyboardEvent) {
    const now = this.percent() / 100;
    const moves: Record<string, number> = { ArrowRight: now + 0.02, ArrowUp: now + 0.02, ArrowLeft: now - 0.02, ArrowDown: now - 0.02, PageUp: now + 0.1, PageDown: now - 0.1, Home: 0, End: 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    this.scrubTo(moves[event.key]);
  }

  protected onScrubPointer(event: PointerEvent, track: HTMLElement) {
    if (event.type === 'pointerdown') track.setPointerCapture(event.pointerId);
    else if (!track.hasPointerCapture(event.pointerId)) return;
    const rect = track.getBoundingClientRect();
    this.scrubTo((event.clientX - rect.left) / rect.width);
  }

  /** While playing natively, a light timer keeps the phase name / angle chip / end-of-show state in step. */
  private watch() {
    if (this.poll) clearInterval(this.poll);
    this.zone.runOutsideAngular(() => {
      this.poll = setInterval(() => this.sync(), 120);
    });
  }

  private sync() {
    const timeline = this.timelines.get(this.active());
    if (!timeline) return;
    const time = timeline.time;
    const phase = phaseAt(time);
    const angle = angleLabelAt(time);
    const percent = Math.round((time / ITEM_MS) * 100);
    const ended = time >= ITEM_MS;
    if (ended && this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
    if (phase === this.phase() && angle === this.angle() && percent === this.percent() && ended === this.explore()) return;
    this.zone.run(() => {
      this.phase.set(phase);
      this.angle.set(angle);
      this.percent.set(percent);
      if (ended) {
        this.playing.set(false);
        this.explore.set(true);
      } else if (this.explore()) {
        this.explore.set(false);
        this.setExplore(0, 0);
      }
    });
  }

  // ---- stepper ---------------------------------------------------------------------
  /** Jump to item `index` (user-initiated: announced). */
  protected go(index: number) {
    if (index === this.active() && this.driver() !== 'scroll') {
      if (this.driver() === 'player') this.replay();
      return;
    }
    const driver = this.driver();
    if (driver === 'scroll') {
      // the scroll position is the clock here, so "jump" means scroll to that item's start
      const rect = this.host.getBoundingClientRect();
      const stage = this.stage()!;
      const travel = rect.height - stage.offsetHeight;
      const top = parseFloat(getComputedStyle(stage).top) || 0;
      const target = window.scrollY + rect.top - top + (itemStart(index) / totalMs(this.items().length)) * travel + 2;
      window.scrollTo({ top: target, behavior: 'smooth' });
    } else if (driver === 'static') {
      this.active.set(index);
      this.setExplore(0, 0);
    } else {
      this.switchTo(index);
    }
    this.say(index);
  }

  /** Player hand-off: the current item is wiped away (970 ms), then the new one plays from the top. */
  private switchTo(index: number) {
    const from = this.active();
    this.pause();
    this.handoff?.destroy();
    const incoming = this.timeline(index);
    incoming?.seek(0);
    this.leaving.set(from);
    this.active.set(index);
    this.explore.set(false);
    this.setExplore(0, 0);
    this.phase.set('set');
    this.percent.set(0);
    const handoff = (this.handoff = this.handoffTimeline(from));
    const finish = () => {
      if (this.handoff !== handoff) return;
      this.zone.run(() => {
        this.leaving.set(null);
        handoff?.destroy();
        this.handoff = null;
        this.timelines.get(from)?.seek(ITEM_MS);
        if (this.active() === index) this.play();
      });
    };
    if (!handoff || !handoff.size) return finish();
    handoff.seek(0);
    handoff.play();
    setTimeout(finish, HANDOFF_MS + 30);
  }

  private say(index = this.active()) {
    const item = this.items()[index];
    if (item) this.announcement.set(`Showing ${item.recipe.name}, ${index + 1} of ${this.items().length}`);
  }

  /** "Skip demo": move focus and the page past the whole section. */
  protected skip(event: Event) {
    event.preventDefault();
    const end = this.host.querySelector<HTMLElement>('.asm__end');
    const rect = this.host.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.bottom - (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) });
    end?.focus({ preventScroll: true });
  }

  // ---- explore: turn the plate by hand ------------------------------------------------
  /** Reduced-motion angle buttons, and the keyboard: apply a camera angle at once. */
  protected setAngle(x: number, z: number, label?: string) {
    cancelAnimationFrame(this.inertia);
    this.setExplore(x, z);
    if (label) this.angle.set(label);
  }

  protected onTurnKey(event: KeyboardEvent) {
    if (!this.explore()) return;
    const step = 15;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [this.ex, this.ez - step], ArrowRight: [this.ex, this.ez + step],
      ArrowUp: [this.ex + step, this.ez], ArrowDown: [this.ex - step, this.ez], Home: [0, 0],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    cancelAnimationFrame(this.inertia);
    this.setExplore(move[0], move[1]);
    this.angle.set(this.ex < 8 ? 'Top-down' : this.ex < 60 ? 'Three-quarter' : 'Low');
  }

  /** Writes the hand-set camera straight to CSS custom properties — no change detection per move. */
  private setExplore(x: number, z: number) {
    this.ex = Math.min(MAX_TILT, Math.max(0, x));
    this.ez = z;
    const stage = this.stage();
    if (!stage) return;
    stage.style.setProperty('--ex', `${this.ex.toFixed(2)}deg`);
    stage.style.setProperty('--ez', `${this.ez.toFixed(2)}deg`);
    stage.classList.toggle('is-tilted', this.ex > 0.5);
  }

  private bindExplore(stage: HTMLElement, cleanups: Array<() => void>) {
    let pointer: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let vz = 0;
    let lastTime = 0;
    const handle = () => stage.querySelector<HTMLElement>('.asm__turn');

    const down = (event: PointerEvent) => {
      const target = handle();
      if (!this.explore() || !target || !(event.target instanceof Node) || !target.contains(event.target)) return;
      pointer = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = event.timeStamp;
      vz = 0;
      cancelAnimationFrame(this.inertia);
      target.style.touchAction = 'none'; // only while dragging; the page scrolls freely otherwise
      try { target.setPointerCapture(pointer); } catch { /* ignore */ }
      stage.classList.add('is-turning');
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      const dt = Math.max(1, event.timeStamp - lastTime);
      vz = vz * 0.6 + ((dx * 0.45) / dt) * 0.4;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = event.timeStamp;
      this.setExplore(this.ex - dy * 0.3, this.ez + dx * 0.45);
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      const target = handle();
      try { target?.releasePointerCapture(pointer); } catch { /* ignore */ }
      if (target) target.style.touchAction = '';
      pointer = null;
      stage.classList.remove('is-turning');
      // inertia only when motion is welcome
      if (this.prefs.reduced() || Math.abs(vz) < 0.02) return;
      let last = performance.now();
      const spin = (now: number) => {
        const dt = Math.min(48, now - last);
        last = now;
        vz *= Math.pow(0.94, dt / 16);
        this.setExplore(this.ex, this.ez + vz * dt);
        if (Math.abs(vz) > 0.01) this.inertia = requestAnimationFrame(spin);
      };
      this.inertia = requestAnimationFrame(spin);
    };
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move, { passive: true });
    stage.addEventListener('pointerup', up, { passive: true });
    stage.addEventListener('pointercancel', up, { passive: true });
    cleanups.push(() => {
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
    });
  }
}
