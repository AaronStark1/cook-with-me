import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GARNISH, GarnishName } from './garnish-glyphs';

/** One flat garnish sticker. Decorative: always hidden from assistive tech. */
@Component({
  selector: 'app-garnish',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="-4 -4 76 76" focusable="false">
      <g class="g-shadow" transform="translate(4.5 4.5)">
        @for (s of base(); track $index) {
          <path [attr.d]="s.d" [attr.transform]="s.t ?? null" />
        }
      </g>
      @for (s of shapes(); track $index) {
        <path [attr.d]="s.d" [attr.transform]="s.t ?? null" [attr.class]="'g-' + s.fill + (s.base ? ' g-key' : '')" />
      }
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: 100%; overflow: visible; }
    path { stroke-linejoin: round; }
    .g-shadow path { fill: var(--broth); stroke: var(--broth); stroke-width: 3px; }
    .g-key { stroke: var(--broth); stroke-width: 3px; paint-order: stroke; }
    .g-ink { fill: var(--ink); }
    .g-yolk { fill: var(--yolk); }
    .g-broth { fill: var(--broth); }
    .g-paper { fill: var(--paper); }
    .g-basil { fill: var(--basil); }
  `,
})
export class Garnish {
  readonly name = input.required<GarnishName>();
  protected readonly shapes = computed(() => GARNISH[this.name()] ?? []);
  protected readonly base = computed(() => this.shapes().filter((s) => s.base));
}
