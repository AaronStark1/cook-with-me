import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ImgFallback, PLATE_SRC } from '../../directives/img-fallback';
import { Garnish } from '../garnish/garnish';
import { GarnishName } from '../garnish/garnish-glyphs';

const SLICES = [1, 2, 3, 4, 5, 6];
const SPARKS = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * The Assembly Demo's turntable — the only 3D in the app besides the hero tilt.
 * One photograph on a plate: contact shadow, thickness slices (visible only
 * when tilted), plate face, the photo, the iris ring, two garnish stickers
 * that always face the camera, and the join burst. Purely presentational: the
 * demo's timeline animates these elements; the hand-set camera arrives as the
 * --ex / --ez custom properties on the stage. Decorative (the host is aria-hidden).
 */
@Component({
  selector: 'app-assembly-plate',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImgFallback, Garnish],
  template: `
    <div class="asm__cam">
      <div class="asm__plate">
        <span class="asm__shadow"></span>
        @for (k of slices; track k) {
          <span class="asm__slice" [style.--k]="k"></span>
        }
        <span class="asm__face"></span>
        <span class="asm__photo">
          <img appImgFallback [src]="image() || plate" alt="" width="640" height="640" decoding="async" draggable="false" />
        </span>
        <span class="asm__iris"></span>
        @for (name of billboards(); track $index) {
          <span class="asm__bb" [class.asm__bb--b]="$index === 1">
            <span class="asm__bb-orbit"><span class="asm__bb-explore"><app-garnish [name]="name" /></span></span>
          </span>
        }
        @for (s of sparks; track s) {
          <span class="asm__spark" [class.is-ink]="s % 3 === 1" [class.is-broth]="s % 3 === 2"></span>
        }
      </div>
    </div>
  `,
  styleUrl: './assembly-plate.css',
})
export class AssemblyPlate {
  readonly image = input<string | undefined>(undefined);
  readonly billboards = input<GarnishName[]>([]);
  protected readonly plate = PLATE_SRC;
  protected readonly slices = SLICES;
  protected readonly sparks = SPARKS;
}
