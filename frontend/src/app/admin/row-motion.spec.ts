import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ROWS_IN_COUNT, ROWS_IN_LIMIT, ROWS_IN_MS, ROWS_IN_STEP_MS, ROW_OUT_MS, RowsIn } from './row-motion';

@Component({
  imports: [RowsIn],
  template: `
    <table>
      <tbody appRowsIn>
        @for (n of rows; track n) {
          <tr><td>{{ n }}</td></tr>
        }
      </tbody>
    </table>
  `,
})
class Host {
  rows: number[] = [];
}

describe('RowsIn (admin table rows)', () => {
  let fixture: ComponentFixture<Host>;
  const tbody = () => (fixture.nativeElement as HTMLElement).querySelector('tbody')!;
  const indexOf = (row: number) => tbody().rows[row].style.getPropertyValue('--i');

  function render(count: number) {
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.rows = Array.from({ length: count }, (_, i) => i);
    fixture.detectChanges();
  }

  it('keeps admin motion quick', () => {
    expect(ROWS_IN_MS).toBeLessThanOrEqual(200);
    expect(ROWS_IN_STEP_MS).toBe(25);
    expect(ROW_OUT_MS).toBe(360);
  });

  it('staggers only the first 10 rows, then takes the class off again', fakeAsync(() => {
    render(12);

    expect(tbody().classList).toContain('rows-in');
    expect(indexOf(0)).toBe('0');
    expect(indexOf(ROWS_IN_COUNT - 1)).toBe(String(ROWS_IN_COUNT - 1));
    expect(indexOf(ROWS_IN_COUNT)).toBe('');
    expect(tbody().rows.length).toBe(12); // every row is rendered; only the arrival is staggered

    tick(ROWS_IN_COUNT * ROWS_IN_STEP_MS + ROWS_IN_MS + 50);
    expect(tbody().classList).not.toContain('rows-in');
  }));

  it('still animates a table of exactly 50 rows', fakeAsync(() => {
    render(ROWS_IN_LIMIT);
    expect(tbody().classList).toContain('rows-in');
    fixture.destroy(); // clears the pending timer
  }));

  it('does nothing at all for more than 50 rows', fakeAsync(() => {
    render(ROWS_IN_LIMIT + 1);
    expect(tbody().classList).not.toContain('rows-in');
    expect(indexOf(0)).toBe('');
    expect(tbody().rows.length).toBe(ROWS_IN_LIMIT + 1);
  }));

  it('does nothing under reduced motion', fakeAsync(() => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    render(5);
    expect(tbody().classList).not.toContain('rows-in');
    expect(indexOf(0)).toBe('');
  }));
});
