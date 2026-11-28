import {
  ADJUSTMENTS_LABEL,
  lastNMonths,
  monthLabel,
  monthlyTotals,
  sumTotals,
  topItems,
  totalsByCard,
  totalsByCategory,
  totalsByStore,
  type InsightReceipt,
} from '@/lib/insights';
import type { LineItem } from '@/lib/types';

const item = (
  nameEn: string,
  lineTotal: number,
  category: string,
  over: Partial<LineItem> = {},
): LineItem => ({
  nameEn,
  quantity: 1,
  unit: 'pcs',
  lineTotal,
  category,
  ...over,
});

const receipts: InsightReceipt[] = [
  {
    kind: 'scanned',
    store: 'ALDI',
    date: '2026-11-02',
    printedTotal: 847,
    cardLast4: '4821',
    category: null,
    items: [
      item('Sauce beans', 239, 'Pantry', { sizeLabel: '420g' }),
      item('Sauce beans', 239, 'Pantry', { sizeLabel: '420g' }),
      item('Toast bread', 369, 'Bakery'),
    ],
    adjustments: [],
  },
  {
    kind: 'scanned',
    store: 'TESCO',
    date: '2026-11-07',
    printedTotal: 1366,
    cardLast4: null,
    category: null,
    items: [
      item('Dates', 449, 'Snacks & Sweets', { sizeLabel: '200g' }),
      item('Milka', 1398, 'Snacks & Sweets', { quantity: 2, unitPrice: 699 }),
      item('Bio bag', 19, 'Household & Cleaning'),
    ],
    adjustments: [
      { type: 'discount', label: 'Clubcard', amount: 500 },
      { type: 'points', label: 'Repont', amount: 50 },
    ],
  },
  {
    kind: 'manual',
    store: 'Yettel Recharge',
    date: '2026-10-13',
    printedTotal: 3000,
    cardLast4: '4821',
    category: 'Phone & Top-ups',
    items: [],
    adjustments: [],
  },
  {
    kind: 'total_only',
    store: 'Kashmiri Bazar',
    date: '2026-11-06',
    printedTotal: 6490,
    cardLast4: '1111',
    category: null,
    items: [],
    adjustments: [],
  },
];

describe('months', () => {
  it('lists the last N months, oldest first, across a year boundary', () => {
    expect(lastNMonths('2026-02-15', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(lastNMonths('2026-11-28', 12)).toHaveLength(12);
    expect(lastNMonths('2026-11-28', 12)[0]).toBe('2025-12');
  });

  it('labels months', () => {
    expect(monthLabel('2026-11')).toBe('Nov 2026');
    expect(monthLabel('2026-01', { short: true })).toBe('Jan');
  });

  it('sums receipt totals per month (scanned = computed, others = printed)', () => {
    expect(monthlyTotals(receipts, ['2026-10', '2026-11', '2026-12'])).toEqual([
      { month: '2026-10', total: 3000 },
      { month: '2026-11', total: 847 + (1866 - 500) + 6490 },
      { month: '2026-12', total: 0 },
    ]);
  });
});

describe('breakdowns', () => {
  it('sumTotals', () => {
    expect(sumTotals(receipts)).toBe(847 + 1366 + 3000 + 6490);
  });

  it('by store, largest first', () => {
    expect(totalsByStore(receipts)).toEqual([
      { label: 'Kashmiri Bazar', total: 6490 },
      { label: 'Yettel Recharge', total: 3000 },
      { label: 'TESCO', total: 1366 },
      { label: 'ALDI', total: 847 },
    ]);
  });

  it('by category: items, receipt category for item-less receipts, and a net adjustments row', () => {
    const rows = totalsByCategory(receipts);
    expect(rows).toEqual([
      { label: 'Other', total: 6490 },
      { label: 'Phone & Top-ups', total: 3000 },
      { label: 'Snacks & Sweets', total: 1847 },
      { label: 'Pantry', total: 478 },
      { label: 'Bakery', total: 369 },
      { label: 'Household & Cleaning', total: 19 },
      { label: ADJUSTMENTS_LABEL, total: -500 },
    ]);
    // Categories always add up to the overall total (points don't count, D14).
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(sumTotals(receipts));
  });

  it('by card: last 4 digits, receipts without a card grouped as null', () => {
    expect(totalsByCard(receipts)).toEqual([
      { card: '1111', total: 6490, count: 1 },
      { card: '4821', total: 3847, count: 2 },
      { card: null, total: 1366, count: 1 },
    ]);
  });
});

describe('topItems', () => {
  it('ranks products by times bought, with average unit price', () => {
    const top = topItems(receipts, 3);
    expect(top[0]).toEqual({
      key: 'sauce beans 420g',
      name: 'Sauce beans 420g',
      count: 2,
      averagePrice: 239,
      unit: 'pcs',
      totalSpent: 478,
    });
    // Ties on count → more money spent first.
    expect(top.slice(1).map((t) => t.key)).toEqual(['milka', 'dates 200g']);
    expect(top[1]!.averagePrice).toBe(699);
  });

  it('limits the list', () => {
    expect(topItems(receipts, 10)).toHaveLength(5);
    expect(topItems([], 10)).toEqual([]);
  });
});
