import { Directive, ElementRef, inject } from '@angular/core';

/** Local top-down plate illustration used whenever a recipe photo is missing or fails to load. */
export const PLATE_SRC = 'assets/plate.svg';

/**
 * `<img appImgFallback [src]="recipe.image">` — if the remote photo 404s or
 * is blocked, swap in the branded plate instead of a broken-image icon.
 */
@Directive({
  selector: 'img[appImgFallback]',
  standalone: true,
  host: {
    '(error)': 'onError()',
    '(load)': 'onLoad()',
  },
})
export class ImgFallback {
  private readonly img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;

  onError() {
    if (this.img.dataset['fallback'] !== '1') {
      this.img.dataset['fallback'] = '1';
      this.img.src = PLATE_SRC;
    }
  }

  // a later successful load (e.g. the [src] binding changed) re-arms the fallback
  onLoad() {
    if (!this.img.src.endsWith(PLATE_SRC)) {
      delete this.img.dataset['fallback'];
    }
  }
}
