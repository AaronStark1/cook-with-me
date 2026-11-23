import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  // Reactive: the navbar updates the moment login/logout changes the session.
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly menuOpen = signal(false);
  protected readonly accountOpen = signal(false);

  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly accountButton = viewChild<ElementRef<HTMLButtonElement>>('accountButton');

  constructor() {
    // Any navigation closes whatever is open, so a menu never lingers over the next page.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.closeAll());
  }

  toggleMenu() {
    this.accountOpen.set(false);
    this.menuOpen.update((open) => !open);
  }

  toggleAccount() {
    this.menuOpen.set(false);
    this.accountOpen.update((open) => !open);
  }

  logout() {
    this.closeAll();
    this.auth.clear();
    this.router.navigate(['/login']);
  }

  /** Escape closes the open menu and hands focus back to the control that opened it. */
  @HostListener('document:keydown.escape')
  protected onEscape() {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
      this.menuButton()?.nativeElement.focus();
    }
    if (this.accountOpen()) {
      this.accountOpen.set(false);
      this.accountButton()?.nativeElement.focus();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent) {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeAll();
    }
  }

  private closeAll() {
    this.menuOpen.set(false);
    this.accountOpen.set(false);
  }
}
