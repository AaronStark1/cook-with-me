import { Directive, ElementRef, NgZone, OnDestroy, effect, inject, input } from '@angular/core';
import { MotionPrefs } from './motion-prefs';

/** Frames of one example being typed, held, then deleted (pure, unit-tested). */
export function typedFrames(prefix: string, word: string, suffix = ''): string[] {
  const frames: string[] = [];
  for (let i = 1; i <= word.length; i++) frames.push(prefix + word.slice(0, i) + suffix);
  for (let i = word.length - 1; i >= 1; i--) frames.push(prefix + word.slice(0, i) + suffix);
  return frames;
}

/**
 * `<input appTypedPlaceholder [examples]="cuisines">` — the placeholder types
 * out real examples one after another. It pauses while the field has focus and
 * is plain static text under reduced motion. The examples must come from real
 * data; with none, the input's own placeholder is left alone.
 */
@Directive({
  selector: 'input[appTypedPlaceholder]',
  standalone: true,
  host: { '(focus)': 'pause()', '(blur)': 'resume()' },
})
export class TypedPlaceholder implements OnDestroy {
  readonly examples = input<string[]>([]);
  /** Text around the typed word, e.g. `Try “` + word + `”`. */
  readonly prefix = input('Try “');
  readonly suffix = input('”');

  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(MotionPrefs);
  private readonly zone = inject(NgZone);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;
  private queue: string[] = [];
  private next = 0;

  constructor() {
    effect(() => {
      const examples = this.examples().filter(Boolean);
      const reduced = this.prefs.reduced();
      this.stop();
      if (!examples.length) return;
      this.el.placeholder = this.prefix() + examples[0] + this.suffix();
      if (reduced || examples.length < 2) return;
      this.queue = examples;
      this.next = 1;
      this.zone.runOutsideAngular(() => this.schedule(() => this.play(), 2600));
    });
  }

  ngOnDestroy() {
    this.stop();
  }

  protected pause() {
    this.paused = true;
  }

  protected resume() {
    this.paused = false;
  }

  private play() {
    const word = this.queue[this.next % this.queue.length];
    this.next++;
    const frames = typedFrames(this.prefix(), word, this.suffix());
    const full = word.length - 1; // index of the fully typed frame
    let i = 0;
    const step = () => {
      if (this.paused) return this.schedule(step, 400);
      this.el.placeholder = frames[i];
      const typed = i === full;
      i++;
      if (typed) return this.schedule(() => this.play(), 2600); // hold the whole word, then move on
      if (i < frames.length && i <= full) this.schedule(step, 70);
    };
    step();
  }

  private schedule(fn: () => void, ms: number) {
    this.timer = setTimeout(fn, ms);
  }

  private stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
