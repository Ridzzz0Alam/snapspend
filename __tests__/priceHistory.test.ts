import {
  effectiveUnitPrice,
  priceHistory,
  sumLineTotals,
  type PricedRow,
} from '@/lib/priceHistory';

const row = (over: Partial<PricedRow>): PricedRow => ({
  date: '2026-11-01',
  time: null,
  store: 'SPAR',
  quantity: 1,
  unit: 'pcs',
  unitPrice: null,
  lineTotal: 100,
  ...over,
});

describe('effectiveUnitPrice', () => {
  it('uses the printed unit price, else line total ÷ quantity (rounded)', () => {
    expect(effectiveUnitPrice(row({ unitPrice: 285, quantity: 2, lineTotal: 570 }))).toBe(285);
    expect(effectiveUnitPrice(row({ quantity: 3, lineTotal: 100 }))).toBe(33);
    expect(effectiveUnitPrice(row({ quantity: 0.792, unit: 'kg', lineTotal: 839 }))).toBe(1059);
  });
});

describe('priceHistory', () => {
  const rows: PricedRow[] = [
    row({ date: '2026-11-10', store: 'TESCO', unitPrice: 299, lineTotal: 299 }),
    row({ date: '2026-11-02', store: 'ALDI', unitPrice: 239, lineTotal: 239 }),
    row({
      date: '2026-11-20',
      time: '18:00',
      store: 'SPAR',
      unitPrice: 259,
      lineTotal: 518,
      quantity: 2,
    }),
    row({ date: '2026-11-20', time: '09:00', store: 'LIDL', unitPrice: 239, lineTotal: 239 }),
  ];

  it('sorts points oldest first and finds last paid, cheapest, average', () => {
    const h = priceHistory(rows)!;
    expect(h.unit).toBe('pcs');
    expect(h.points.map((p) => [p.date, p.store, p.price])).toEqual([
      ['2026-11-02', 'ALDI', 239],
      ['2026-11-10', 'TESCO', 299],
      ['2026-11-20', 'LIDL', 239],
      ['2026-11-20', 'SPAR', 259],
    ]);
    expect(h.last).toMatchObject({ store: 'SPAR', price: 259, date: '2026-11-20' });
    // Two stores tie at 239: the most recent one wins.
    expect(h.cheapest).toMatchObject({ store: 'LIDL', price: 239, date: '2026-11-20' });
    expect(h.average).toBe(259); // (239 + 299 + 239 + 259) / 4 = 259
    expect(h.timesBought).toBe(4);
    expect(h.totalSpent).toBe(299 + 239 + 518 + 239);
  });

  it('uses the unit of the most recent purchase when units are mixed', () => {
    const h = priceHistory([
      row({ date: '2026-11-01', unit: 'pcs', unitPrice: 500, lineTotal: 500 }),
      row({ date: '2026-11-05', unit: 'kg', quantity: 0.5, unitPrice: 1200, lineTotal: 600 }),
    ])!;
    expect(h.unit).toBe('kg');
    expect(h.points).toHaveLength(1);
    expect(h.timesBought).toBe(1);
  });

  it('ignores returned items (negative lines)', () => {
    const h = priceHistory([
      row({ lineTotal: 239, unitPrice: 239 }),
      row({ lineTotal: -239, unitPrice: 239 }),
    ])!;
    expect(h.points).toHaveLength(1);
  });

  it('returns null when there is nothing to show', () => {
    expect(priceHistory([])).toBeNull();
    expect(priceHistory([row({ lineTotal: -10 })])).toBeNull();
  });
});

describe('sumLineTotals', () => {
  it('adds line totals, including returns', () => {
    expect(sumLineTotals([{ lineTotal: 100 }, { lineTotal: 250 }, { lineTotal: -50 }])).toBe(300);
    expect(sumLineTotals([])).toBe(0);
  });
});
