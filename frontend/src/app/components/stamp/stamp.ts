import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A rotated cream stamp ("SAVED", "SENT", "UPDATED") that slams in over a hard
 * burst of eight squares, then fades. Purely decorative confirmation — the
 * real message is always given in text elsewhere — so it is aria-hidden.
 * Render it with `@if` when the success happens; it animates on creation.
 * Under reduced motion it does not appear at all (the text carries the news).
 */
@Component({
  selector: 'app-stamp',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (i of squares; track i) {
      <span class="spark" [style.--a]="i * 45 + 'deg'" [class.is-ink]="i % 3 === 1" [class.is-broth]="i % 3 === 2"></span>
    }
    <span class="stamp">{{ text() }}</span>
  `,
  styles: `
    :host {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 5;
      width: 0;
      height: 0;
      pointer-events: none;
    }
    .stamp {
      position: absolute;
      left: 0;
      top: 0;
      padding: 0.35rem 0.7rem 0.25rem;
      font-family: var(--font-display);
      font-size: 1.15rem;
      line-height: 1;
      text-transform: uppercase;
      white-space: nowrap;
      color: var(--broth);
      background: var(--ink);
      border: 3px solid var(--broth);
      box-shadow: 4px 4px 0 var(--broth);
      translate: -50% -50%;
      rotate: -6deg;
      /* slam in (no bounce), hold, fade */
      animation: stamp-in 120ms var(--ease) both, stamp-out 260ms linear 1.6s forwards;
    }
    .spark {
      position: absolute;
      left: -0.3rem;
      top: -0.3rem;
      width: 0.6rem;
      height: 0.6rem;
      background: var(--yolk);
      opacity: 0;
      animation: spark-out 400ms var(--ease-arrive) both;
    }
    .spark.is-ink { background: var(--ink); }
    .spark.is-broth { background: var(--broth); }
    @keyframes stamp-in { from { scale: 1.4; opacity: 0; } to { scale: 1; opacity: 1; } }
    @keyframes stamp-out { to { opacity: 0; } }
    @keyframes spark-out {
      from { opacity: 1; transform: rotate(var(--a)) translateY(-0.6rem); }
      to { opacity: 0; transform: rotate(var(--a)) translateY(-3.4rem); }
    }
    @media (prefers-reduced-motion: reduce) {
      :host { display: none; }
    }
  `,
})
export class Stamp {
  readonly text = input('Saved');
  protected readonly squares = [0, 1, 2, 3, 4, 5, 6, 7];
}
