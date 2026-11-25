import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MotionPrefs } from '../../motion/motion-prefs';
import { Reveal } from '../../motion/reveal';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, Reveal],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  protected readonly year = new Date().getFullYear();
  protected readonly letters = ['C', 'o', 'o', 'k'];
  private readonly prefs = inject(MotionPrefs);

  /** Smooth scroll to the top (instant under reduced motion), then hand keyboard users the start of the page. */
  protected toTop() {
    window.scrollTo({ top: 0, behavior: this.prefs.reduced() ? 'auto' : 'smooth' });
    document.getElementById('main')?.focus({ preventScroll: true });
  }
}
