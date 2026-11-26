import { formatAmount, formatFt, parseHuf } from '@/lib/money';

describe('formatAmount', () => {
  it.each([
    [0, '0'],
    [19, '19'],
    [847, '847'],
    [999, '999'],
    [1000, '1.000'],
    [3894, '3.894'],
    [10076, '10.076'],
    [1234567, '1.234.567'],
    [-1250, '-1.250'],
  ])('%p → %p', (n, expected) => {
    expect(formatAmount(n)).toBe(expected);
  });

  it('rounds non-integers', () => {
    expect(formatAmount(581.006)).toBe('581');
  });
});

describe('formatFt', () => {
  it('appends " Ft"', () => {
    expect(formatFt(3894)).toBe('3.894 Ft');
    expect(formatFt(847)).toBe('847 Ft');
  });
});

describe('parseHuf', () => {
  it.each([
    ['1059', 1059],
    ['1 059', 1059],
    ['1 059', 1059],
    ['1.059', 1059],
    ['1059 Ft', 1059],
    ['1059Ft', 1059],
    ['1.059 Ft', 1059],
    ['1 059 Ft', 1059],
    ['HUF 1059', 1059],
    ['1059 HUF', 1059],
    ['10.076', 10076],
    ['1.234.567', 1234567],
    ['1 059,50', 1060],
    ['1059,4', 1059],
    ['12.5', 13],
    ['-250', -250],
    ['−250 Ft', -250],
    ['0', 0],
    ['  847  ', 847],
  ])('%p → %p', (s, expected) => {
    expect(parseHuf(s)).toBe(expected);
  });

  it.each(['', 'Ft', 'abc', '12a', '1.05.9', '1,2,3', '1.059.5', '-', '1,'])(
    '%p → null',
    (s) => {
      expect(parseHuf(s)).toBeNull();
    },
  );
});
