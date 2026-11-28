import {
  addDays,
  defaultGrandTotal,
  formatRange,
  normalizeRange,
  presetRange,
  RANGE_PRESETS,
} from '@/lib/ranges';

// Saturday 28 November 2026
const today = '2026-11-28';

describe('presetRange', () => {
  it('this week = Monday up to today (weeks start on Monday, D62)', () => {
    expect(presetRange('thisWeek', today)).toEqual({ from: '2026-11-23', to: '2026-11-28' });
    expect(presetRange('thisWeek', '2026-11-23')).toEqual({ from: '2026-11-23', to: '2026-11-23' }); // Monday
    expect(presetRange('thisWeek', '2026-11-29')).toEqual({ from: '2026-11-23', to: '2026-11-29' }); // Sunday
  });

  it('this week can start in the previous month or year', () => {
    expect(presetRange('thisWeek', '2026-12-02')).toEqual({ from: '2026-11-30', to: '2026-12-02' });
    expect(presetRange('thisWeek', '2027-01-01')).toEqual({ from: '2026-12-28', to: '2027-01-01' });
  });

  it('this month = 1st up to today', () => {
    expect(presetRange('thisMonth', today)).toEqual({ from: '2026-11-01', to: '2026-11-28' });
  });

  it('last month = the whole previous month', () => {
    expect(presetRange('lastMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetRange('lastMonth', '2027-01-15')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
    expect(presetRange('lastMonth', '2028-03-10')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    }); // leap
  });

  it('today', () => {
    expect(presetRange('today', today)).toEqual({ from: today, to: today });
  });

  it('lists the presets in display order', () => {
    expect(RANGE_PRESETS.map((p) => p.key)).toEqual([
      'today',
      'thisWeek',
      'thisMonth',
      'lastMonth',
    ]);
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('normalizeRange', () => {
  it('swaps a backwards custom range', () => {
    expect(normalizeRange({ from: '2026-11-20', to: '2026-11-10' })).toEqual({
      from: '2026-11-10',
      to: '2026-11-20',
    });
    const ok = { from: '2026-11-10', to: '2026-11-20' };
    expect(normalizeRange(ok)).toEqual(ok);
  });
});

describe('defaultGrandTotal', () => {
  it('is on when the range covers more than one day (SPEC §2.4)', () => {
    expect(defaultGrandTotal({ from: '2026-11-23', to: '2026-11-28' })).toBe(true);
    expect(defaultGrandTotal({ from: today, to: today })).toBe(false);
  });
});

describe('formatRange', () => {
  it('shows DD/MM/YYYY, one date for a single day', () => {
    expect(formatRange({ from: '2026-11-23', to: '2026-11-28' })).toBe('23/11/2026 – 28/11/2026');
    expect(formatRange({ from: today, to: today })).toBe('28/11/2026');
  });
});
