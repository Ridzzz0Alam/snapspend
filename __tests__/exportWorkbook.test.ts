import { buildExportSheets, exportFileName, type ExportReceipt } from '@/lib/exportWorkbook';

const receipts: ExportReceipt[] = [
  {
    kind: 'scanned',
    store: 'TESCO',
    date: '2026-11-07',
    time: '18:05',
    printedTotal: 1366,
    cardLast4: '4821',
    category: null,
    note: null,
    items: [
      {
        nameEn: 'Milka',
        nameOriginal: 'MILKA ALPESI',
        sizeLabel: '90g',
        quantity: 2,
        unit: 'pcs',
        unitPrice: 699,
        lineTotal: 1398,
        category: 'Snacks & Sweets',
      },
      {
        nameEn: 'Banana',
        nameOriginal: null,
        sizeLabel: null,
        quantity: 0.792,
        unit: 'kg',
        unitPrice: null,
        lineTotal: 839,
        category: 'Fruit & Veg',
      },
    ],
    adjustments: [
      { type: 'discount', label: 'Clubcard', amount: 900 },
      { type: 'charge', label: 'Deposit', amount: 29 },
      { type: 'points', label: 'Repont', amount: 50 },
    ],
  },
  {
    kind: 'manual',
    store: 'Yettel Recharge',
    date: '2026-11-02',
    time: null,
    printedTotal: 3000,
    cardLast4: null,
    category: 'Phone & Top-ups',
    note: 'monthly',
    items: [],
    adjustments: [],
  },
];

describe('buildExportSheets', () => {
  const [itemsSheet, receiptsSheet] = buildExportSheets(receipts);

  it('Items sheet: one row per item, oldest receipt first, unit price filled in', () => {
    expect(itemsSheet!.name).toBe('Items');
    expect(itemsSheet!.columns.map((c) => c.header)).toEqual([
      'Date',
      'Time',
      'Store',
      'Item',
      'Original name',
      'Size',
      'Qty',
      'Unit',
      'Unit price (Ft)',
      'Total (Ft)',
      'Category',
      'Card',
    ]);
    expect(itemsSheet!.rows).toEqual([
      [
        { date: '2026-11-07' },
        '18:05',
        'TESCO',
        'Milka',
        'MILKA ALPESI',
        '90g',
        2,
        'pcs',
        699,
        1398,
        'Snacks & Sweets',
        '4821',
      ],
      [
        { date: '2026-11-07' },
        '18:05',
        'TESCO',
        'Banana',
        null,
        null,
        0.792,
        'kg',
        1059,
        839,
        'Fruit & Veg',
        '4821',
      ],
    ]);
  });

  it('Receipts sheet: totals, adjustments split out, manual entries included', () => {
    expect(receiptsSheet!.name).toBe('Receipts');
    expect(receiptsSheet!.columns.map((c) => c.header)).toEqual([
      'Date',
      'Time',
      'Store',
      'Type',
      'Total (Ft)',
      'Printed total (Ft)',
      'Items',
      'Discounts (Ft)',
      'Charges (Ft)',
      'Points (Ft)',
      'Card',
      'Category',
      'Note',
    ]);
    expect(receiptsSheet!.rows).toEqual([
      [
        { date: '2026-11-02' },
        null,
        'Yettel Recharge',
        'Manual',
        3000,
        3000,
        0,
        null,
        null,
        null,
        null,
        'Phone & Top-ups',
        'monthly',
      ],
      [
        { date: '2026-11-07' },
        '18:05',
        'TESCO',
        'Scanned',
        1366,
        1366,
        2,
        900,
        29,
        50,
        '4821',
        null,
        null,
      ],
    ]);
  });
});

describe('exportFileName', () => {
  it('dates the file', () => {
    expect(exportFileName('2026-11-28', 'xlsx')).toBe('snapspend-2026-11-28.xlsx');
    expect(exportFileName('2026-11-28', 'json')).toBe('snapspend-backup-2026-11-28.json');
  });
});
