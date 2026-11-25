import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, input, output, signal, viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { RecipeModel } from '../../models/recipe-model';
import { Apiservice } from '../../services/apiservice';
import { AuthService } from '../../services/auth';
import { RecipeProgress } from '../../services/recipe-progress';
import { MotionPrefs } from '../../motion/motion-prefs';
import { DUR } from '../../motion/tokens';
import { MotionHandle, WipeDir, arrive, drift, group, sweep, wipe } from '../../motion/wipe';
import { Odometer } from '../odometer/odometer';
import { Stamp } from '../stamp/stamp';

/** Step fields rotate through the hero's colours; cream text is ≥ 5:1 on each. */
export const COOK_COLORS = ['#C8281C', '#B4410E', '#9B1B3C', '#2F5A2E'] as const;
/** A horizontal drag past this many px (and mostly horizontal) is a swipe. */
export const COOK_SWIPE_PX = 45;

/** Where to resume: the saved step when it still fits this recipe, otherwise the start. */
export function resumeStep(saved: { step: number; total: number } | null, total: number): number {
  if (!saved || saved.total !== total || !Number.isInteger(saved.step)) return 0;
  return saved.step >= 0 && saved.step < total ? saved.step : 0;
}

/** −1 / +1 / 0 for a pointer gesture: left = next, right = previous. */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) <= COOK_SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

type SlotId = 'a' | 'b';
type SaveState = 'idle' | 'saving' | 'saved' | 'already' | 'error';

/**
 * Cook Mode — a distraction-free, big-type, one-step-at-a-time view for
 * actually cooking. Lazy-loaded; a native <dialog> (focus trap, Escape).
 * Each step change is the §4.2 wipe, mirrored for Previous.
 */
@Component({
  selector: 'app-cook-mode',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Odometer, Stamp],
  templateUrl: './cook-mode.html',
  styleUrl: './cook-mode.css',
})
export class CookMode {
  readonly recipe = input.required<RecipeModel>();
  readonly closed = output<void>();
  /** Kept for hosts that want to react; Cook Mode saves through the API itself. */
  readonly save = output<void>();

  private readonly prefs = inject(MotionPrefs);
  private readonly api = inject(Apiservice);
  protected readonly auth = inject(AuthService);
  protected readonly progress = inject(RecipeProgress);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly slotIds: SlotId[] = ['a', 'b'];
  protected readonly recipeId = computed(() => this.recipe()._id ?? '');
  protected readonly steps = computed(() => this.recipe().instructions ?? []);
  protected readonly ingredients = computed(() => this.recipe().ingredients ?? []);
  protected readonly total = computed(() => this.steps().length);
  /** 0 … total − 1 are steps; `total` is the "Nice one." screen. */
  protected readonly index = signal(0);
  protected readonly finished = computed(() => this.index() >= this.total());
  protected readonly dots = computed(() => Array.from({ length: this.total() }, (_, i) => i));

  private readonly panels = { a: signal(0), b: signal(0) };
  protected readonly active = signal<SlotId>('a');
  protected readonly leaving = signal<SlotId | null>(null);
  protected readonly drawer = signal(false);
  protected readonly announcement = signal('');
  protected readonly saveState = signal<SaveState>('idle');
  protected readonly saveError = signal('');

  private motion: MotionHandle | null = null;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private restoreOverflow = '';
  private swipe: { x: number; y: number; id: number } | null = null;

  constructor() {
    afterNextRender(() => {
      const start = resumeStep(this.progress.cookPosition(this.recipeId()), this.total());
      this.index.set(start);
      this.panels[this.active()].set(start);
      this.restoreOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden'; // the page behind must not scroll
      this.dialog().nativeElement.showModal();
      this.announce();
      this.keepAwake();
    });
    const onVisible = () => {
      if (!document.hidden) this.keepAwake();
    };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
      this.release();
    });
  }

  protected panel(id: SlotId) {
    return this.panels[id]();
  }

  protected color(step: number) {
    return COOK_COLORS[step % COOK_COLORS.length];
  }

  // ---- moving between steps ---------------------------------------------------
  protected next() {
    this.go(this.index() + 1, 1);
  }

  protected previous() {
    this.go(this.index() - 1, -1);
  }

  protected go(to: number, dir: WipeDir) {
    if (to < 0 || to > this.total() || to === this.index()) return;
    this.settle(); // latest wins: any wipe in flight drops to its end state
    const from = this.active();
    const incoming: SlotId = from === 'a' ? 'b' : 'a';
    this.panels[incoming].set(to);
    this.index.set(to);
    this.active.set(incoming);
    this.drawer.set(false);
    this.progress.setCookPosition(this.recipeId(), { step: to, total: this.total(), name: this.recipe().name });
    this.announce();
    if (this.prefs.reduced()) return; // instant swap
    this.leaving.set(from);
    afterNextRender(() => this.play(from, incoming, dir), { injector: this.injector });
  }

  private play(from: SlotId, to: SlotId, dir: WipeDir) {
    if (this.leaving() !== from || this.active() !== to) return;
    const root = this.dialog().nativeElement;
    const q = (slot: SlotId, part: string) => root.querySelector(`[data-slot="${slot}"] ${part}`);
    const width = root.clientWidth;
    const duration = DUR.wipeStep;
    const motion = (this.motion = group([
      // the old step: its colour panel slides off with the yolk edge; its content is clipped and drifts 14 %
      sweep(q(from, '.cook__field'), { dir, duration }),
      wipe(q(from, '.cook__content'), { dir, duration }),
      drift(q(from, '.cook__drift'), { dir, width, duration }),
      // the new step arrives with parallax: numeral .55, text .40, landing at 92 % of the run
      arrive(q(to, '.cook__n'), { dir, width, duration, factor: 0.55 }),
      arrive(q(to, '.cook__text'), { dir, width, duration, factor: 0.4 }),
    ]));
    motion.finished.then(() => {
      if (this.motion === motion) this.settle();
    });
  }

  private settle() {
    this.motion?.cancel();
    this.motion = null;
    this.leaving.set(null);
  }

  private announce() {
    const i = this.index();
    this.announcement.set(
      this.finished() ? `Finished cooking ${this.recipe().name ?? 'the recipe'}. Nice one.` : `Step ${i + 1} of ${this.total()}: ${this.steps()[i]}`,
    );
  }

  // ---- input --------------------------------------------------------------------
  protected onKey(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const onControl = !!(event.target as HTMLElement | null)?.closest?.('button, a, input, [role="slider"]');
    if (event.key === 'ArrowRight') this.next();
    else if (event.key === 'ArrowLeft') this.previous();
    // Space / Enter advance — unless they are being used to press a focused control
    else if ((event.key === ' ' || event.key === 'Enter') && !onControl) this.next();
    else return;
    event.preventDefault();
  }

  protected onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }

  protected onPointerUp(event: PointerEvent) {
    const start = this.swipe;
    this.swipe = null;
    if (!start || start.id !== event.pointerId) return;
    const step = swipeStep(event.clientX - start.x, event.clientY - start.y);
    if (step === 1) this.next();
    else if (step === -1) this.previous();
  }

  protected onPointerCancel() {
    this.swipe = null;
  }

  protected toggleDrawer() {
    this.drawer.update((open) => !open);
  }

  // ---- finish: save ---------------------------------------------------------------
  /** Uses the existing save endpoint; the outcome is always stated in text. */
  protected saveToCollection() {
    if (this.saveState() === 'saving' || this.saveState() === 'saved') return;
    this.saveState.set('saving');
    this.save.emit();
    this.api.saveRecipeAPI(this.recipeId()).subscribe({
      next: () => this.saveState.set('saved'),
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) return this.saveState.set('already');
        this.saveError.set(err.error?.message || 'Could not save the recipe. Please try again.');
        this.saveState.set('error');
      },
    });
  }

  // ---- screen wake lock: best effort, silently skipped where unsupported -----------
  private async keepAwake() {
    if (this.wakeLock || !this.dialog().nativeElement.open) return;
    try {
      const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void>; addEventListener?: (t: string, cb: () => void) => void }> } }).wakeLock;
      if (!wakeLock) return;
      const lock = await wakeLock.request('screen');
      lock.addEventListener?.('release', () => {
        if (this.wakeLock === lock) this.wakeLock = null; // the browser drops it when the tab is hidden
      });
      this.wakeLock = lock;
    } catch {
      /* denied, low battery, unsupported — cooking still works */
    }
  }

  private release() {
    this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
    document.documentElement.style.overflow = this.restoreOverflow;
  }

  protected close() {
    this.dialog().nativeElement.close();
    this.finish();
  }

  /** Fired by the native dialog (Escape, or after our own close()). */
  protected onClose() {
    this.finish();
  }

  /** Runs exactly once however the dialog was closed: stop motion, give back scroll and the wake lock, tell the host. */
  private finish() {
    if (this.done) return;
    this.done = true;
    this.settle();
    this.release();
    this.closed.emit();
  }
  private done = false;
}
