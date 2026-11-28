import { formatBytes, isStricter, parseRetention, retentionCutoff } from '@/lib/retention';

describe('retentionCutoff', () => {
  it('is null for Never', () => {
    expect(retentionCutoff('never', '2026-11-28')).toBeNull();
  });
  it('goes back calendar months', () => {
    expect(retentionCutoff('6m', '2026-11-28')).toBe('2026-05-28');
    expect(retentionCutoff('1y', '2026-11-28')).toBe('2025-11-28');
  });
  it('crosses the year boundary', () => {
    expect(retentionCutoff('6m', '2026-03-15')).toBe('2025-09-15');
    expect(retentionCutoff('6m', '2026-01-01')).toBe('2025-07-01');
  });
  it('clamps to the end of shorter months, including leap years', () => {
    expect(retentionCutoff('6m', '2026-08-31')).toBe('2026-02-28');
    expect(retentionCutoff('6m', '2028-08-31')).toBe('2028-02-29');
    expect(retentionCutoff('1y', '2028-02-29')).toBe('2027-02-28');
    expect(retentionCutoff('6m', '2026-12-31')).toBe('2026-06-30');
  });
});

describe('parseRetention', () => {
  it('accepts stored values and falls back to Never', () => {
    expect(parseRetention('6m')).toBe('6m');
    expect(parseRetention('1y')).toBe('1y');
    expect(parseRetention(null)).toBe('never');
    expect(parseRetention('3m')).toBe('never');
  });
});

describe('isStricter', () => {
  it('is true only when the new setting keeps photos for less time', () => {
    expect(isStricter('never', '1y')).toBe(true);
    expect(isStricter('1y', '6m')).toBe(true);
    expect(isStricter('6m', '1y')).toBe(false);
    expect(isStricter('1y', 'never')).toBe(false);
    expect(isStricter('6m', '6m')).toBe(false);
  });
});

describe('formatBytes', () => {
  it('shows KB below 1 MB and MB with one decimal above', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(150 * 1024)).toBe('150 KB');
    expect(formatBytes(1.45 * 1024 * 1024)).toBe('1.4 MB');
  });
});
