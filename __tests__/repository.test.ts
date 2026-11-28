/**
 * @jest-environment node
 */
import { count } from 'drizzle-orm';

import {
  createReceiptWithItems,
  deleteReceipt,
  listByDateRange,
  listItems,
  updateReceipt,
  type ReceiptInput,
} from '@/db/repository';
import { adjustments, items, receipts } from '@/db/schema';
import { clearSampleData, countSampleReceipts, SEED_NOTE, seedSampleData } from '@/db/seed';
import { seedReceipts } from '@/db/seedData';
import type { AppDatabase } from '@/db/types';
import { formatDailyLog } from '@/lib/format';

import {
  golden1Expected,
  golden1Receipts,
  golden2Expected,
  golden2Receipts,
  golden3Expected,
  golden3Receipts,
} from './fixtures/golden';
import { createTestDb, testDeps } from './helpers/testDb';

let db: AppDatabase;
beforeEach(async () => {
  db = await createTestDb();
});

const rowCount = (table: typeof receipts | typeof items | typeof adjustments) =>
  db.select({ n: count() }).from(table).get()?.n ?? 0;

const tesco = golden3Receipts[0]!;

describe('createReceiptWithItems', () => {
  it('stores the receipt, items in order, adjustments and derived fields', () => {
    const id = createReceiptWithItems(
      db,
      { ...tesco, imagePaths: ['file:///a.jpg', 'file:///b.jpg'], cardLast4: '4821' },
      testDeps(),
    );
    expect(id).toBe('id-001');

    const [r] = listByDateRange(db, '2026-11-07', '2026-11-07');
    expect(r).toMatchObject({
      id: 'id-001',
      kind: 'scanned',
      store: 'TESCO',
      printedTotal: 1366,
      computedTotal: 1366,
      cardLast4: '4821',
      imagePaths: '["file:///a.jpg","file:///b.jpg"]',
      createdAt: 1000,
      updatedAt: 1000,
    });
    expect(r!.items.map((i) => [i.position, i.nameEn, i.normalizedKey, i.category])).toEqual([
      [0, 'Dates', 'dates 200g', 'Snacks & Sweets'],
      [1, 'Milka Alpine milk chocolate', 'milka alpine milk chocolate 90g', 'Snacks & Sweets'],
      [2, 'Bio bag', 'bio bag', 'Household & Cleaning'],
    ]);
    expect(r!.adjustments.map((a) => [a.type, a.amount])).toEqual([
      ['discount', 100],
      ['discount', 400],
    ]);
  });

  it('defaults a missing category to Other and keeps kg quantities exact', () => {
    createReceiptWithItems(db, {
      kind: 'scanned',
      store: 'LIDL',
      date: '2026-11-20',
      printedTotal: 581,
      items: [{ nameEn: 'Banana', quantity: 0.792, unit: 'kg', unitPrice: 449, lineTotal: 356 }],
      adjustments: [],
    });
    const [item] = listItems(db);
    expect(item).toMatchObject({ category: 'Other', quantity: 0.792, unit: 'kg' });
  });

  it('rolls back everything if any row fails', () => {
    const bad: ReceiptInput = {
      ...tesco,
      items: [...tesco.items, { ...tesco.items[0]!, quantity: null as never }],
    };
    expect(() => createReceiptWithItems(db, bad)).toThrow();
    expect(rowCount(receipts)).toBe(0);
    expect(rowCount(items)).toBe(0);
  });

  it('stores total-only and manual receipts with no items', () => {
    for (const r of golden2Receipts) createReceiptWithItems(db, r);
    expect(rowCount(receipts)).toBe(3);
    expect(rowCount(items)).toBe(2);
  });
});

describe('listByDateRange + formatDailyLog (golden tests through the database)', () => {
  it.each([
    ['golden 1', golden1Receipts, golden1Expected, false],
    ['golden 2', golden2Receipts, golden2Expected, true],
    ['golden 3', golden3Receipts, golden3Expected, false],
  ] as const)('%s', (_n, input, expected, grandTotal) => {
    for (const r of input) createReceiptWithItems(db, r);
    const stored = listByDateRange(db, '2026-11-01', '2026-11-30');
    expect(formatDailyLog(stored, { grandTotal })).toBe(expected);
  });
});

describe('listByDateRange', () => {
  beforeEach(() => {
    const deps = testDeps();
    for (const r of seedReceipts) createReceiptWithItems(db, r, deps);
  });

  it('is inclusive at both ends', () => {
    expect(listByDateRange(db, '2026-11-06', '2026-11-07').map((r) => r.store)).toEqual([
      'SPAR',
      'Kashmiri Bazar',
      'TESCO',
    ]);
  });

  it('orders by date, then time with untimed receipts last', () => {
    createReceiptWithItems(db, { ...golden2Receipts[0]!, date: '2026-11-02' });
    expect(listByDateRange(db, '2026-11-02', '2026-11-02').map((r) => r.store)).toEqual([
      'ALDI',
      'SPAR (Interspar)',
      'Yettel Recharge',
    ]);
  });

  it('returns [] for an empty range', () => {
    expect(listByDateRange(db, '2027-01-01', '2027-01-31')).toEqual([]);
  });
});

describe('updateReceipt', () => {
  it('replaces fields, items and adjustments, keeping createdAt', () => {
    const deps = testDeps();
    const id = createReceiptWithItems(db, tesco, deps);
    const ok = updateReceipt(
      db,
      id,
      {
        ...tesco,
        store: 'TESCO Extra',
        printedTotal: 449,
        items: [tesco.items[0]!],
        adjustments: [],
      },
      deps,
    );
    expect(ok).toBe(true);

    const [r] = listByDateRange(db, '2026-11-07', '2026-11-07');
    expect(r).toMatchObject({ store: 'TESCO Extra', computedTotal: 449, createdAt: 1000 });
    expect(r!.updatedAt).toBeGreaterThan(1000);
    expect(r!.items.map((i) => i.nameEn)).toEqual(['Dates']);
    expect(r!.adjustments).toEqual([]);
    expect(rowCount(items)).toBe(1);
    expect(rowCount(adjustments)).toBe(0);
  });

  it('returns false for an unknown id and writes nothing', () => {
    expect(updateReceipt(db, 'nope', tesco)).toBe(false);
    expect(rowCount(receipts)).toBe(0);
    expect(rowCount(items)).toBe(0);
  });
});

describe('deleteReceipt (soft delete, D44)', () => {
  it('sets deletedAt and updatedAt but keeps the rows, items and adjustments', () => {
    const id = createReceiptWithItems(db, tesco, testDeps(1_000));
    expect(db.select().from(receipts).get()?.deletedAt).toBeNull();

    expect(deleteReceipt(db, id, { now: () => 5_000 })).toBe(true);
    const row = db.select().from(receipts).get();
    expect(row).toMatchObject({ id, deletedAt: 5_000, updatedAt: 5_000, createdAt: 1_000 });
    expect(rowCount(receipts)).toBe(1);
    expect(rowCount(items)).toBe(tesco.items.length);
    expect(rowCount(adjustments)).toBe(tesco.adjustments.length);
  });

  it('returns false for an unknown or already deleted id', () => {
    expect(deleteReceipt(db, 'nope')).toBe(false);
    const id = createReceiptWithItems(db, tesco);
    expect(deleteReceipt(db, id, { now: () => 5_000 })).toBe(true);
    expect(deleteReceipt(db, id, { now: () => 9_000 })).toBe(false);
    expect(db.select().from(receipts).get()?.deletedAt).toBe(5_000);
  });

  it('hides deleted receipts from listByDateRange and listItems', () => {
    const deps = testDeps();
    const ids = seedReceipts.map((r) => createReceiptWithItems(db, r, deps));
    const tescoId = ids[seedReceipts.findIndex((r) => r.store === 'TESCO')]!;
    deleteReceipt(db, tescoId);

    const listed = listByDateRange(db, '2026-11-01', '2026-11-30');
    expect(listed).toHaveLength(seedReceipts.length - 1);
    expect(listed.map((r) => r.id)).not.toContain(tescoId);
    expect(listItems(db).map((r) => r.receiptId)).not.toContain(tescoId);
    expect(listItems(db, { stores: ['TESCO'] })).toEqual([]);
  });

  it('leaves deleted receipts out of the Daily Log totals', () => {
    for (const r of golden3Receipts) createReceiptWithItems(db, r);
    const extra = createReceiptWithItems(db, { ...tesco, printedTotal: 999 });
    deleteReceipt(db, extra);
    expect(
      formatDailyLog(listByDateRange(db, '2026-11-01', '2026-11-30'), { grandTotal: false }),
    ).toBe(golden3Expected);
  });

  it('updateReceipt refuses a deleted receipt', () => {
    const id = createReceiptWithItems(db, tesco);
    deleteReceipt(db, id);
    expect(updateReceipt(db, id, { ...tesco, store: 'ALDI' })).toBe(false);
    expect(db.select().from(receipts).get()?.store).toBe('TESCO');
  });
});

describe('listItems', () => {
  beforeEach(() => {
    const deps = testDeps();
    for (const r of seedReceipts) createReceiptWithItems(db, r, deps);
  });

  it('defaults to newest first, keeping receipt order within a receipt', () => {
    const rows = listItems(db);
    expect(rows).toHaveLength(17);
    expect(rows.slice(0, 3).map((r) => [r.date, r.nameEn])).toEqual([
      ['2026-11-07', 'Dates'],
      ['2026-11-07', 'Milka Alpine milk chocolate'],
      ['2026-11-07', 'Bio bag'],
    ]);
    expect(rows.at(-1)).toMatchObject({ date: '2026-11-02', store: 'ALDI', nameEn: 'Toast bread' });
  });

  it('filters by date range, store and category', () => {
    const rows = listItems(db, {
      from: '2026-11-02',
      to: '2026-11-06',
      stores: ['SPAR', 'SPAR (Interspar)'],
      categories: ['Pantry'],
    });
    expect(rows.map((r) => r.nameEn).sort()).toEqual([
      'Chopped tomatoes',
      'Peeled tomatoes',
      'Sweet corn',
    ]);
  });

  it('searches English and original names, ignoring case and accents', () => {
    createReceiptWithItems(db, {
      kind: 'scanned',
      store: 'LIDL',
      date: '2026-11-21',
      printedTotal: 499,
      items: [
        {
          nameEn: 'Curd cheese',
          nameOriginal: 'TÚRÓ RÖGÖS',
          quantity: 1,
          unit: 'pcs',
          lineTotal: 499,
          category: 'Dairy & Eggs',
        },
      ],
      adjustments: [],
    });
    expect(listItems(db, { search: 'turo' }).map((r) => r.nameEn)).toEqual(['Curd cheese']);
    expect(listItems(db, { search: 'CHOCOLATE' }).map((r) => r.nameEn)).toEqual([
      'Milka Alpine milk chocolate',
      'Milk chocolate bar',
      'Chocolate donut',
    ]);
  });

  it('sorts by amount (largest first by default) and by name A–Z', () => {
    expect(listItems(db, {}, { by: 'amount' })[0]).toMatchObject({ lineTotal: 1398 });
    expect(
      listItems(db, {}, { by: 'name' })
        .slice(0, 2)
        .map((r) => r.nameEn),
    ).toEqual(['Banana', 'Bio bag']);
    expect(listItems(db, {}, { by: 'amount', dir: 'asc' })[0]).toMatchObject({ lineTotal: 19 });
  });
});

describe('dev seed', () => {
  it('adds the sample receipts once and removes only them', () => {
    const real = createReceiptWithItems(db, { ...tesco, date: '2026-11-25' });
    expect(seedSampleData(db)).toBe(6);
    expect(seedSampleData(db)).toBe(0);
    expect(countSampleReceipts(db)).toBe(6);
    expect(
      listByDateRange(db, '2026-11-01', '2026-11-30').filter((r) => r.note === SEED_NOTE),
    ).toHaveLength(6);

    expect(clearSampleData(db)).toBe(6);
    expect(listByDateRange(db, '2026-11-01', '2026-11-30').map((r) => r.id)).toEqual([real]);
  });

  it('counts only live sample receipts and clears deleted ones too', () => {
    seedSampleData(db);
    const [first] = listByDateRange(db, '2026-11-01', '2026-11-30');
    deleteReceipt(db, first!.id);
    expect(countSampleReceipts(db)).toBe(5);
    expect(clearSampleData(db)).toBe(6);
    expect(rowCount(receipts)).toBe(0);
  });
});
