import * as fs from 'fs';
import * as path from 'path';

import { formatDailyLog, formatItemToken, formatLogDate, formatReceiptLine } from '@/lib/format';
import type { ReceiptData } from '@/lib/types';

import {
  golden1Expected,
  golden1Receipts,
  golden2Expected,
  golden2Receipts,
  golden3Expected,
  golden3Receipts,
} from './fixtures/golden';

describe('golden tests (SPEC §6, byte for byte)', () => {
  it('golden test 1', () => {
    expect(formatDailyLog(golden1Receipts, { grandTotal: false })).toBe(golden1Expected);
  });

  it('golden test 2 (total-only + manual + grand total)', () => {
    expect(formatDailyLog(golden2Receipts, { grandTotal: true })).toBe(golden2Expected);
  });

  it('golden test 3 (discount)', () => {
    expect(formatDailyLog(golden3Receipts, { grandTotal: false })).toBe(golden3Expected);
  });

  it('uses U+00D7 and U+2212, never ASCII x or -', () => {
    const out = formatDailyLog(golden3Receipts, { grandTotal: false });
    expect(out).toContain('2Db×699Ft/Db');
    expect(out).toContain('19Ft − Clubcard');
  });
});

describe('formatDailyLog', () => {
  it('returns empty string for no receipts, even with grand total', () => {
    expect(formatDailyLog([], { grandTotal: true })).toBe('');
  });

  it('orders receipts by time, untimed last, then createdAt', () => {
    const r = (store: string, time: string | null, createdAt: number): ReceiptData => ({
      kind: 'manual',
      store,
      date: '2026-11-01',
      time,
      printedTotal: 1,
      items: [],
      adjustments: [],
      createdAt,
    });
    const out = formatDailyLog(
      [r('D', null, 2), r('C', null, 1), r('B', '15:00', 0), r('A', '08:00', 9)],
      {
        grandTotal: false,
      },
    );
    expect(
      out
        .split('\n')
        .slice(1, 5)
        .map((l) => l[0]),
    ).toEqual(['A', 'B', 'C', 'D']);
  });

  it('prints a grand total for a single day when asked', () => {
    expect(formatDailyLog(golden3Receipts, { grandTotal: true })).toBe(
      `${golden3Expected}\n\nGRAND TOTAL - 1,366 Ft`,
    );
  });
});

describe('formatItemToken', () => {
  it('derives unit price from lineTotal when missing (D16)', () => {
    expect(
      formatItemToken({ nameEn: 'Egg', quantity: 3, unit: 'pcs', unitPrice: null, lineTotal: 200 }),
    ).toBe('Egg 3Db×67Ft/Db 200Ft');
  });

  it('prints non-integer pcs quantity as-is (D17)', () => {
    expect(
      formatItemToken({
        nameEn: 'Cake',
        quantity: 1.5,
        unit: 'pcs',
        unitPrice: 400,
        lineTotal: 600,
      }),
    ).toBe('Cake 1.5Db×400Ft/Db 600Ft');
  });

  it('pads kg to three decimals and separates thousands in unit price', () => {
    expect(
      formatItemToken({
        nameEn: 'Cheese',
        quantity: 0.5,
        unit: 'kg',
        unitPrice: 4590,
        lineTotal: 2295,
      }),
    ).toBe('Cheese 0.500Kg×4,590Ft/Kg 2,295Ft');
  });
});

describe('formatReceiptLine', () => {
  it('appends charges with " + " and skips points (D14)', () => {
    const r: ReceiptData = {
      kind: 'scanned',
      store: 'Kohinoor',
      date: '2026-11-01',
      printedTotal: 1650,
      items: [{ nameEn: 'Curry', quantity: 1, unit: 'pcs', lineTotal: 1500 }],
      adjustments: [
        { type: 'charge', label: 'Service charge 10%', amount: 150 },
        { type: 'points', label: 'Repont', amount: 100 },
      ],
    };
    expect(formatReceiptLine(r)).toBe(
      'Kohinoor => Curry 1,500Ft + Service charge 10% 150Ft = 1,650 Ft',
    );
  });
});

describe('formatLogDate', () => {
  it('converts ISO to DD/MM/YYYY', () => {
    expect(formatLogDate('2026-01-09')).toBe('09/01/2026');
  });
});

describe('fixtures match docs/SPEC.md §6 verbatim', () => {
  const spec = fs.readFileSync(path.join(__dirname, '..', 'docs', 'SPEC.md'), 'utf8');

  const block = (heading: string): string => {
    const start = spec.indexOf(heading);
    const open = spec.indexOf('```\n', start) + 4;
    const close = spec.indexOf('\n```', open);
    return spec.slice(open, close);
  };

  it.each([
    ['### Golden test 1', golden1Expected],
    ['### Golden test 2', golden2Expected],
    ['### Golden test 3', golden3Expected],
  ])('%s', (heading, expected) => {
    expect(block(heading)).toBe(expected);
  });
});
