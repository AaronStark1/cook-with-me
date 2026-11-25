import { Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { Toasts } from './components/toasts/toasts';
import { fontsReady, introClaimed, playIntro } from './motion/intro';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, Toasts],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('cook-with-me');
  private readonly router = inject(Router);

  // The admin area has its own sidebar layout, so the public navbar/footer are hidden there.
  protected readonly isAdminArea = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects.startsWith('/admin'))
    ),
    { initialValue: inject(Location).path().startsWith('/admin') }
  );

  /** Page title, announced politely after each route change (never on the first load). */
  protected readonly announcement = signal('');
  private lastPath: string | null = null;

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((event) => {
        const path = event.urlAfterRedirects.split(/[?#]/)[0];
        const first = this.lastPath === null;
        const changed = path !== this.lastPath;
        this.lastPath = path;

        if (first) {
          // Deep link: no hero to start the opening sequence, so the header's part plays on its own.
          fontsReady(600).then(() => {
            if (!introClaimed()) playIntro();
          });
          return;
        }
        // Filters, search and other same-route query changes must not steal focus.
        if (!changed) return;
        // The title strategy and the new route's DOM settle in this same turn; announce after it.
        setTimeout(() => {
          document.getElementById('main')?.focus({ preventScroll: true });
          this.announcement.set(document.title);
        });
      });
  }

  /** `href="#main"` would be resolved against <base href="/"> and navigate home, so focus it directly. */
  protected skipToMain(event: Event) {
    event.preventDefault();
    const main = document.getElementById('main');
    main?.focus();
    main?.scrollIntoView();
  }
}
