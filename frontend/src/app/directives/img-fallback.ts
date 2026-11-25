import { Directive, ElementRef, OnInit, inject } from '@angular/core';
import { MotionPrefs } from '../motion/motion-prefs';

/** Local top-down plate illustration used whenever a recipe photo is missing or fails to load. */
export const PLATE_SRC = 'assets/plate.svg';

/**
 * `<img appImgFallback [src]="recipe.image">` — if the remote photo 404s or
 * is blocked, swap in the branded plate instead of a broken-image icon.
 *
 * It also reports loading as classes, so editorial photos can be uncovered from
 * their colour field (see `.photo:has(> img.is-arming)` in motion.css): `is-arming` while a
 * not-yet-loaded image is waiting, `is-loaded` once it (or the plate) is in.
 * Cached images are complete before we look, so they are never armed.
 */
@Directive({
  selector: 'img[appImgFallback]',
  standalone: true,
  host: {
    '(error)': 'onError()',
    '(load)': 'onLoad()',
  },
})
export class ImgFallback implements OnInit {
  private readonly img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(MotionPrefs);

  ngOnInit() {
    // Runs before the [src] binding is written, so `complete` is still about the previous state:
    // check again once the binding has landed.
    queueMicrotask(() => {
      if (this.img.complete && this.img.naturalWidth > 0) this.img.classList.add('is-loaded');
      else if (!this.prefs.reduced()) this.img.classList.add('is-arming');
    });
  }

  onError() {
    if (this.img.dataset['fallback'] !== '1') {
      this.img.dataset['fallback'] = '1';
      this.img.src = PLATE_SRC;
    } else {
      // even the plate failed: never leave the frame covered forever
      this.img.classList.add('is-loaded');
    }
  }

  // a later successful load (e.g. the [src] binding changed) re-arms the fallback
  onLoad() {
    this.img.classList.add('is-loaded');
    if (!this.img.src.endsWith(PLATE_SRC)) {
      delete this.img.dataset['fallback'];
    }
  }
}
