import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Toast, ToastService } from './toast.service';

/** The toast stack in the app shell: bottom-left on desktop, full width above the safe area on phones. */
@Component({
  selector: 'app-toasts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (toast of service.toasts(); track toast.id) {
      <div
        class="toast"
        [class.toast--error]="toast.kind === 'error'"
        [attr.role]="toast.kind === 'error' ? 'alert' : 'status'"
        animate.enter="toast-in"
        animate.leave="toast-out"
        (pointerenter)="service.pause(toast.id)"
        (pointerleave)="service.resume(toast.id)"
        (focusin)="service.pause(toast.id)"
        (focusout)="service.resume(toast.id)"
      >
        <p class="toast__text">{{ toast.text }}</p>
        @if (toast.action; as action) {
          <button type="button" class="toast__action" (click)="run(toast)">{{ action.label }}</button>
        }
        <button type="button" class="toast__x" (click)="service.dismiss(toast.id)" aria-label="Dismiss">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      left: var(--gutter);
      bottom: calc(1rem + env(safe-area-inset-bottom));
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: min(26rem, calc(100vw - var(--gutter) * 2));
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.35rem 0.35rem 1rem;
      background: var(--broth);
      color: var(--ink);
      border: 2px solid var(--ink);
      border-left: 8px solid var(--yolk);
      pointer-events: auto;
    }
    .toast__text {
      flex: 1;
      margin: 0;
      font-weight: 700;
    }
    .toast__action,
    .toast__x {
      flex: none;
      min-width: 44px;
      min-height: 44px;
      padding: 0 0.8rem;
      font: 800 0.75rem/1 var(--font-body);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--broth);
      background: var(--yolk);
      border: 0;
      cursor: pointer;
    }
    .toast__x {
      padding: 0;
      color: var(--ink);
      background: transparent;
    }
    .toast__action:hover { background: var(--ink); }
    .toast__x:hover { color: var(--yolk); }
    /* in from the left; out by a clip-wipe */
    .toast-in { animation: toast-in 420ms var(--ease-arrive) both; }
    .toast-out { animation: toast-out 240ms var(--ease-wipe) both; }
    @keyframes toast-in { from { translate: -120% 0; } }
    @keyframes toast-out { to { clip-path: inset(0 100% 0 0); } }
    @media (max-width: 640px) {
      :host { left: 0; bottom: env(safe-area-inset-bottom); width: 100vw; }
    }
    @media (prefers-reduced-motion: reduce) {
      .toast-in, .toast-out { animation: none; }
    }
  `,
})
export class Toasts {
  protected readonly service = inject(ToastService);

  protected run(toast: Toast) {
    toast.action?.run();
    this.service.dismiss(toast.id);
  }
}
