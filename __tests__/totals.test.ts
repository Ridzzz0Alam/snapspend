import { computedTotal, dayTotals, pointsTotal, receiptTotal, sanityCheck } from '@/lib/totals';
import type { Adjustment, LineItem, ReceiptData } from '@/lib/types';

const item = (lineTotal: number): LineItem => ({
  nameEn: 'x',
  quantity: 1,
  unit: 'pcs',
  lineTotal,
});

const tesco: ReceiptData = {
  kind: 'scanned',
  store: 'TESCO',
  date: '2026-11-07',
  printedTotal: 1366,
  items: [item(449), item(1398), item(19)],
  adjustments: [
    { type: 'discount', label: 'Clubcard discount', amount: 100 },
    { type: 'discount', label: 'Clubcard discount', amount: 400 },
  ],
};

describe('computedTotal', () => {
  it('subtracts discounts', () => {
    expect(computedTotal(tesco.items, tesco.adjustments)).toBe(1366);
  });

  it('adds charges and ignores points', () => {
    const adjustments: Adjustment[] = [
      { type: 'charge', label: 'Service charge 10%', amount: 150 },
      { type: 'points', label: 'Repont', amount: 300 },
    ];
    expect(computedTotal([item(1500)], adjustments)).toBe(1650);
  });

  it('is 0 for no items', () => {
    expect(computedTotal([], [])).toBe(0);
  });
});

describe('pointsTotal', () => {
  it('sums only points', () => {
    expect(
      pointsTotal([
        { type: 'points', label: 'Repont', amount: 200 },
        { type: 'discount', label: 'd', amount: 50 },
        { type: 'points', label: 'Repont', amount: 100 },
      ]),
    ).toBe(300);
  });
});

describe('receiptTotal', () => {
  it('uses computedTotal for scanned receipts', () => {
    expect(receiptTotal({ ...tesco, printedTotal: 9999 })).toBe(1366);
  });

  it('uses printedTotal for total_only and manual', () => {
    const base = { store: 'X', date: '2026-11-06', items: [], adjustments: [] };
    expect(receiptTotal({ ...base, kind: 'total_only', printedTotal: 6490 })).toBe(6490);
    expect(receiptTotal({ ...base, kind: 'manual', printedTotal: 3000 })).toBe(3000);
  });
});

describe('dayTotals', () => {
  it('groups by date in ascending order', () => {
    const manual = (date: string, total: number): ReceiptData => ({
      kind: 'manual',
      store: 'X',
      date,
      printedTotal: total,
      items: [],
      adjustments: [],
    });
    const totals = dayTotals([manual('2026-11-13', 3000), tesco, manual('2026-11-07', 34)]);
    expect([...totals.entries()]).toEqual([
      ['2026-11-07', 1400],
      ['2026-11-13', 3000],
    ]);
  });
});

describe('sanityCheck', () => {
  it('is ok when computed equals printed', () => {
    expect(sanityCheck(tesco)).toEqual({ computed: 1366, printed: 1366, diff: 0, ok: true });
  });

  it('reports the difference when they disagree', () => {
    expect(sanityCheck({ ...tesco, printedTotal: 1400 })).toEqual({
      computed: 1366,
      printed: 1400,
      diff: 34,
      ok: false,
    });
  });

  it('accepts a printed total that is after points redemption', () => {
    const r = {
      items: [item(2000)],
      adjustments: [{ type: 'points', label: 'Repont', amount: 500 } as const],
      printedTotal: 1500,
    };
    expect(sanityCheck(r)).toEqual({ computed: 2000, printed: 1500, diff: -500, ok: true });
  });
});
