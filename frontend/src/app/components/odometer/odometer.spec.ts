import { TestBed } from '@angular/core/testing';
import { Odometer, odometerDigits } from './odometer';

describe('odometer', () => {
  it('splits a value into padded digit columns', () => {
    expect(odometerDigits(3, 2)).toEqual([0, 3]);
    expect(odometerDigits(12, 2)).toEqual([1, 2]);
    expect(odometerDigits(120)).toEqual([1, 2, 0]);
    expect(odometerDigits(0)).toEqual([0]);
  });

  it('never produces junk for missing or odd input', () => {
    expect(odometerDigits(undefined, 2)).toEqual([0, 0]);
    expect(odometerDigits(NaN)).toEqual([0]);
    expect(odometerDigits(-4)).toEqual([0]);
    expect(odometerDigits(7.6)).toEqual([8]);
  });

  it('exposes the real value as text and hides the rolling columns', () => {
    const fixture = TestBed.createComponent(Odometer);
    fixture.componentRef.setInput('value', 12);
    fixture.componentRef.setInput('label', '12 recipes');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent!.trim()).toBe('12 recipes');
    expect(el.querySelector('.odo')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelectorAll('.odo__col').length).toBe(2);
    expect((el.querySelectorAll('.odo__col')[1] as HTMLElement).style.getPropertyValue('--d')).toBe('2');
  });
});
