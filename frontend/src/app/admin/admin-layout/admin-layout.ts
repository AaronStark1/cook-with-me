import { Component, ElementRef, HostListener, ViewEncapsulation, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.html',
  // The shared admin primitives (page heads, panels, tables, toolbars…) are used by every
  // admin page, so this layout ships them unencapsulated. Every selector is prefixed
  // with `.admin`, and the styles are removed again when the admin area is left.
  styleUrls: ['./admin-layout.css', './admin-shared.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AdminLayout {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Mobile top-bar menu. On wide screens the sidebar is always visible and this is ignored.
  protected readonly navOpen = signal(false);
  private readonly navToggle = viewChild<ElementRef<HTMLButtonElement>>('navToggle');

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.navOpen.set(false));
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
