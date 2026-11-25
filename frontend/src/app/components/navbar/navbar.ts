import { Component, DestroyRef, ElementRef, HostListener, NgZone, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth';
import { ScrollState } from '../../motion/scroll-state';
import { fontsReady } from '../../motion/intro';

/** The header gains its hard drop once the page has scrolled this far (px). */
export const STUCK_AFTER = 8;

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
  private readonly zone = inject(NgZone);
  private readonly scroll = inject(ScrollState);

  protected readonly menuOpen = signal(false);
  protected readonly accountOpen = signal(false);

  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly accountButton = viewChild<ElementRef<HTMLButtonElement>>('accountButton');
  private readonly list = viewChild<ElementRef<HTMLUListElement>>('list');

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Any navigation closes whatever is open, so a menu never lingers over the next page.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        this.closeAll();
        // routerLinkActive updates during the next render; glide the bar once it has
        this.zone.runOutsideAngular(() => requestAnimationFrame(() => this.placeBar()));
      });

    afterNextRender(() => {
      const list = this.list()?.nativeElement;
      if (!list) return;
      this.zone.runOutsideAngular(() => {
        // First paint: place the bar with no animation, then switch the glide on.
        this.placeBar();
        fontsReady(1500).then(() => {
          this.placeBar();
          requestAnimationFrame(() => requestAnimationFrame(() => list.classList.add('is-ready')));
        });

        const cleanups: Array<() => void> = [];
        if (typeof ResizeObserver !== 'undefined') {
          const resize = new ResizeObserver(() => this.placeBar());
          resize.observe(list);
          cleanups.push(() => resize.disconnect());
        }

        // hover / keyboard focus previews the bar under another link; leaving returns it
        const preview = (event: Event) => {
          const link = (event.target as HTMLElement).closest?.('a');
          if (link && list.contains(link)) this.placeBar(link as HTMLElement);
        };
        const restore = () => this.placeBar();
        list.addEventListener('pointerover', preview, { passive: true });
        list.addEventListener('focusin', preview, { passive: true });
        list.addEventListener('pointerleave', restore, { passive: true });
        list.addEventListener('focusout', restore, { passive: true });

        // "stuck" state + scroll progress (the progress bar is pure CSS where scroll timelines exist)
        const el = this.host.nativeElement;
        const scrubbed = typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: scroll()');
        cleanups.push(
          this.scroll.onFrame(({ y, progress }) => {
            el.classList.toggle('is-stuck', y > STUCK_AFTER);
            if (!scrubbed) el.style.setProperty('--scroll-p', progress.toFixed(4));
          }),
        );
        el.classList.toggle('is-stuck', window.scrollY > STUCK_AFTER);

        destroyRef.onDestroy(() => cleanups.forEach((fn) => fn()));
      });
    });
  }

  /** Move the single yolk bar under `target` (default: the active route's link). */
  private placeBar(target?: HTMLElement | null) {
    const list = this.list()?.nativeElement;
    if (!list) return;
    const link = target ?? list.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!link) {
      list.style.setProperty('--bar-w', '0'); // no active link (e.g. /login): the bar closes where it is
    } else {
      const box = list.getBoundingClientRect();
      const rect = link.getBoundingClientRect();
      list.style.setProperty('--bar-x', `${(rect.left - box.left).toFixed(2)}px`);
      list.style.setProperty('--bar-w', rect.width.toFixed(2));
    }
    list.classList.add('has-bar');
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
