import { Component, DestroyRef, ElementRef, HostListener, NgZone, ViewEncapsulation, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth';
import { MotionPrefs } from '../../motion/motion-prefs';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.html',
  // The shared admin primitives (page heads, panels, tables, toolbars…) are used by every
  // admin page, so this layout ships them unencapsulated. Every selector is prefixed
  // with `.admin`, and the styles are removed again when the admin area is left.
  styleUrls: ['./admin-layout.css', './admin-shared.css', './admin-motion.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AdminLayout {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly prefs = inject(MotionPrefs);

  // Mobile top-bar menu. On wide screens the sidebar is always visible and this is ignored.
  protected readonly navOpen = signal(false);
  private readonly navToggle = viewChild<ElementRef<HTMLButtonElement>>('navToggle');
  private readonly navList = viewChild<ElementRef<HTMLUListElement>>('navList');

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        this.navOpen.set(false);
        // routerLinkActive updates during the next render; glide the bar once it has
        this.zone.runOutsideAngular(() => requestAnimationFrame(() => this.placeBar()));
      });

    afterNextRender(() => {
      const list = this.navList()?.nativeElement;
      if (!list) return;
      this.zone.runOutsideAngular(() => {
        const first = requestAnimationFrame(() => this.placeBar());
        destroyRef.onDestroy(() => cancelAnimationFrame(first));
        if (typeof ResizeObserver === 'undefined') return;
        // also fires when the mobile menu opens/closes (the list goes to and from zero size)
        const resize = new ResizeObserver(() => this.placeBar());
        resize.observe(list);
        destroyRef.onDestroy(() => resize.disconnect());
      });
    });
  }

  /**
   * Move the single sidebar edge bar to the active route's link. The first placement has no
   * animation; `.is-ready` then enables the glide (never under reduced motion). While the list
   * cannot be measured (closed mobile menu) the classes come off and each link shows its own edge.
   */
  placeBar() {
    const list = this.navList()?.nativeElement;
    if (!list) return;
    const box = list.getBoundingClientRect();
    if (!box.height) {
      list.classList.remove('has-bar', 'is-ready');
      return;
    }

    const link = list.querySelector<HTMLElement>('a[aria-current="page"]');
    if (link) {
      const rect = link.getBoundingClientRect();
      list.style.setProperty('--bar-y', `${(rect.top - box.top).toFixed(2)}px`);
      list.style.setProperty('--bar-h', rect.height.toFixed(2));
    } else {
      list.style.setProperty('--bar-h', '0'); // no active link (add / edit recipe): the bar closes where it is
    }

    if (list.classList.contains('has-bar')) return;
    list.classList.add('has-bar');
    if (this.prefs.reduced()) return;
    this.zone.runOutsideAngular(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (list.classList.contains('has-bar')) list.classList.add('is-ready');
        }),
      ),
    );
  }

  toggleNav() {
    this.navOpen.update((open) => !open);
  }

  /** Escape closes the menu and returns focus to the button that opened it. */
  @HostListener('document:keydown.escape')
  protected onEscape() {
    if (this.navOpen()) {
      this.navOpen.set(false);
      this.navToggle()?.nativeElement.focus();
    }
  }

  // The public navbar is hidden in the admin area, so the sidebar carries logout.
  logout() {
    this.auth.clear();
    this.router.navigate(['/login']);
  }
}
