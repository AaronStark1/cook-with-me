import { Injectable, signal } from '@angular/core';

export interface ToastAction { label: string; run: () => void }
export interface Toast {
  id: number;
  text: string;
  kind: 'status' | 'error';
  action?: ToastAction;
}

export const TOAST_MS = 5000;

/**
 * Transient feedback for things that have no feedback of their own (link
 * copied, undo). It must not repeat an inline `.alert` — screen-reader users
 * would hear everything twice.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private next = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  show(text: string, options: { kind?: Toast['kind']; action?: ToastAction } = {}): number {
    const id = this.next++;
    this._toasts.update((list) => [...list.slice(-2), { id, text, kind: options.kind ?? 'status', action: options.action }]);
    this.resume(id);
    return id;
  }

  error(text: string) {
    return this.show(text, { kind: 'error' });
  }

  dismiss(id: number) {
    this.pause(id);
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  /** Hover / focus holds a toast open. */
  pause(id: number) {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
  }

  resume(id: number) {
    this.pause(id);
    this.timers.set(id, setTimeout(() => this.dismiss(id), TOAST_MS));
  }
}
