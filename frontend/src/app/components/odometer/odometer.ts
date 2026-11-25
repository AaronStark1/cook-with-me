import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Digits of a non-negative integer, left-padded with zeros to `pad` places. */
export function odometerDigits(value: number | null | undefined, pad = 1): number[] {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value as number)) : 0;
  return String(safe).padStart(Math.max(1, pad), '0').split('').map(Number);
}

/**
 * A number whose digits roll vertically when it changes.
 * The real value is a visually-hidden text node (that is what assistive tech
 * and tests read); the rolling columns are decorative and drawn from CSS
 * generated content, so no stray digits ever land in the DOM text.
 */
@Component({
  selector: 'app-odometer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="visually-hidden">{{ text() }}</span>
    <span class="odo" aria-hidden="true">
      @for (digit of digits(); track $index) {
        <span class="odo__col" [style.--d]="digit"></span>
      }
    </span>
  `,
  styles: `
    :host { display: inline-block; }
    .odo { display: inline-flex; }
    .odo__col { display: block; height: 1em; overflow: clip; line-height: 1; }
    .odo__col::before {
      content: '0\\A 1\\A 2\\A 3\\A 4\\A 5\\A 6\\A 7\\A 8\\A 9';
      display: block;
      white-space: pre;
      text-align: center;
      transform: translateY(calc(var(--d, 0) * -10%));
      transition: transform 620ms var(--ease-arrive);
    }
    @media (prefers-reduced-motion: reduce) {
      .odo__col::before { transition: none; }
    }
  `,
})
export class Odometer {
  readonly value = input<number | null | undefined>(0);
  /** Minimum number of digits (leading zeros). */
  readonly pad = input(1);
  /** Accessible text; defaults to the padded number. */
  readonly label = input<string | null>(null);

  protected readonly digits = computed(() => odometerDigits(this.value(), this.pad()));
  protected readonly text = computed(() => this.label() ?? this.digits().join(''));
}
