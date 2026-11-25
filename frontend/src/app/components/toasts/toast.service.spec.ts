import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TOAST_MS, ToastService } from './toast.service';
import { Toasts } from './toasts';

describe('toasts', () => {
  it('auto-dismisses after 5s, and hover/focus holds it open', fakeAsync(() => {
    const service = new ToastService();
    const id = service.show('Link copied');
    tick(TOAST_MS - 1);
    expect(service.toasts().length).toBe(1);
    service.pause(id);
    tick(TOAST_MS * 2);
    expect(service.toasts().length).toBe(1);
    service.resume(id);
    tick(TOAST_MS);
    expect(service.toasts().length).toBe(0);
  }));

  it('keeps at most three on screen', fakeAsync(() => {
    const service = new ToastService();
    ['a', 'b', 'c', 'd'].forEach((t) => service.show(t));
    expect(service.toasts().map((t) => t.text)).toEqual(['b', 'c', 'd']);
    tick(TOAST_MS);
  }));

  it('renders status toasts politely, errors as alerts, and runs an action once', async () => {
    const fixture = TestBed.createComponent(Toasts);
    const service = TestBed.inject(ToastService);
    const undo = jasmine.createSpy('undo');
    service.show('Removed', { action: { label: 'Undo', run: undo } });
    const errorId = service.error('Could not undo');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const toasts = el.querySelectorAll('.toast');
    expect(toasts[0].getAttribute('role')).toBe('status');
    expect(toasts[1].getAttribute('role')).toBe('alert');

    (toasts[0].querySelector('.toast__action') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(service.toasts().map((t) => t.text)).toEqual(['Could not undo']);
    service.dismiss(errorId);
  });
});
