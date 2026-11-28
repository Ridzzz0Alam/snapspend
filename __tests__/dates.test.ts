import { isoFromDate, parseDisplayDate, parseTime } from '@/lib/dates';

describe('parseDisplayDate', () => {
  it('reads DD/MM/YYYY', () => {
    expect(parseDisplayDate('27/11/2026')).toBe('2026-11-27');
    expect(parseDisplayDate(' 2/3/2026 ')).toBe('2026-03-02');
  });

  it('also accepts dots, dashes and ISO input', () => {
    expect(parseDisplayDate('27.11.2026')).toBe('2026-11-27');
    expect(parseDisplayDate('27-11-2026')).toBe('2026-11-27');
    expect(parseDisplayDate('2026-11-27')).toBe('2026-11-27');
    expect(parseDisplayDate('2026.11.27.')).toBe('2026-11-27');
  });

  it('rejects impossible or incomplete dates', () => {
    expect(parseDisplayDate('31/02/2026')).toBeNull();
    expect(parseDisplayDate('27/13/2026')).toBeNull();
    expect(parseDisplayDate('27/11')).toBeNull();
    expect(parseDisplayDate('')).toBeNull();
    expect(parseDisplayDate('yesterday')).toBeNull();
  });
});

describe('parseTime', () => {
  it('reads H:MM / HH:MM / HH.MM and blank as null', () => {
    expect(parseTime('18:42')).toEqual({ ok: true, value: '18:42' });
    expect(parseTime('8:05')).toEqual({ ok: true, value: '08:05' });
    expect(parseTime('18.42')).toEqual({ ok: true, value: '18:42' });
    expect(parseTime('  ')).toEqual({ ok: true, value: null });
  });

  it('rejects bad times', () => {
    expect(parseTime('24:00').ok).toBe(false);
    expect(parseTime('12:60').ok).toBe(false);
    expect(parseTime('noon').ok).toBe(false);
  });
});

describe('isoFromDate', () => {
  it('uses the local calendar date (D20)', () => {
    expect(isoFromDate(new Date(2026, 10, 28, 23, 59))).toBe('2026-11-28');
    expect(isoFromDate(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});
