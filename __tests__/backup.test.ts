/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';

import { buildBackup, mergeBackup, parseBackup } from '@/db/backup';
import {
  createReceiptWithItems,
  deleteReceipt,
  getReceipt,
  listByDateRange,
  updateReceipt,
} from '@/db/repository';
import { receipts, storeAliases } from '@/db/schema';
import { seedReceipts } from '@/db/seedData';
import type { AppDatabase } from '@/db/types';
import { formatDailyLog } from '@/lib/format';

import { createTestDb, testDeps } from './helpers/testDb';

let a: AppDatabase;
let b: AppDatabase;
beforeEach(async () => {
  a = await createTestDb();
  b = await createTestDb();
});

const everything = (db: AppDatabase) => listByDateRange(db, '0000-01-01', '9999-12-31');
const json = (db: AppDatabase, now = 9_000_000) => JSON.stringify(buildBackup(db, now));

function seedA() {
  const deps = testDeps();
  return seedReceipts.map((r) => createReceiptWithItems(a, r, deps));
}

describe('JSON backup round trip', () => {
  it('restores every receipt, item and adjustment exactly (Daily Log identical)', () => {
    seedA();
    a.insert(storeAliases).values({ raw: 'INTERSPAR', canonical: 'SPAR (Interspar)' }).run();

    const parsed = parseBackup(json(a));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(mergeBackup(b, parsed.backup)).toEqual({ added: 6, updated: 0, unchanged: 0 });

    expect(everything(b)).toEqual(everything(a));
    expect(formatDailyLog(everything(b), { grandTotal: true })).toBe(
      formatDailyLog(everything(a), { grandTotal: true }),
    );
    expect(b.select().from(storeAliases).all()).toEqual([
      { raw: 'INTERSPAR', canonical: 'SPAR (Interspar)' },
    ]);
  });

  it('importing the same backup twice changes nothing', () => {
    seedA();
    const parsed = parseBackup(json(a));
    if (!parsed.ok) throw new Error(parsed.error);
    mergeBackup(b, parsed.backup);
    expect(mergeBackup(b, parsed.backup)).toEqual({ added: 0, updated: 0, unchanged: 6 });
    expect(everything(b)).toHaveLength(6);
  });
});

describe('merge by id + updatedAt (D44)', () => {
  it('a newer copy in the backup replaces the local one; an older one is ignored', () => {
    const [id] = seedA();
    // b gets the original
    const first = parseBackup(json(a));
    if (!first.ok) throw new Error(first.error);
    mergeBackup(b, first.backup);

    // a edits the receipt later → backup is newer → b takes it
    const original = getReceipt(a, id!)!;
    updateReceipt(
      a,
      id!,
      { ...original, imagePaths: null, store: 'ALDI Debrecen' },
      { now: () => 5_000_000 },
    );
    const newer = parseBackup(json(a));
    if (!newer.ok) throw new Error(newer.error);
    expect(mergeBackup(b, newer.backup)).toEqual({ added: 0, updated: 1, unchanged: 5 });
    expect(getReceipt(b, id!)!.store).toBe('ALDI Debrecen');

    // b edits it even later; importing a's (older) copy must not overwrite b's edit
    updateReceipt(
      b,
      id!,
      { ...getReceipt(b, id!)!, imagePaths: null, store: 'ALDI (b)' },
      { now: () => 7_000_000 },
    );
    expect(mergeBackup(b, newer.backup).updated).toBe(0);
    expect(getReceipt(b, id!)!.store).toBe('ALDI (b)');
  });

  it('a delete travels with the backup (soft-deleted rows are included)', () => {
    const ids = seedA();
    const first = parseBackup(json(a));
    if (!first.ok) throw new Error(first.error);
    mergeBackup(b, first.backup);

    deleteReceipt(a, ids[0]!, { now: () => 6_000_000 });
    const after = parseBackup(json(a));
    if (!after.ok) throw new Error(after.error);
    expect(mergeBackup(b, after.backup).updated).toBe(1);
    expect(getReceipt(b, ids[0]!)).toBeNull();
    expect(b.select().from(receipts).where(eq(receipts.id, ids[0]!)).get()?.deletedAt).toBe(
      6_000_000,
    );
  });

  it('keeps local receipts the backup does not know about', () => {
    seedA();
    const local = createReceiptWithItems(b, { ...seedReceipts[0]!, store: 'Only on b' });
    const parsed = parseBackup(json(a));
    if (!parsed.ok) throw new Error(parsed.error);
    mergeBackup(b, parsed.backup);
    expect(getReceipt(b, local)!.store).toBe('Only on b');
    expect(everything(b)).toHaveLength(7);
  });

  it('does not overwrite a local store alias', () => {
    b.insert(storeAliases).values({ raw: 'INTERSPAR', canonical: 'Interspar (mine)' }).run();
    a.insert(storeAliases)
      .values([
        { raw: 'INTERSPAR', canonical: 'SPAR (Interspar)' },
        { raw: 'TESCO EXTRA', canonical: 'TESCO' },
      ])
      .run();
    const parsed = parseBackup(json(a));
    if (!parsed.ok) throw new Error(parsed.error);
    mergeBackup(b, parsed.backup);
    expect(b.select().from(storeAliases).all()).toEqual([
      { raw: 'INTERSPAR', canonical: 'Interspar (mine)' },
      { raw: 'TESCO EXTRA', canonical: 'TESCO' },
    ]);
  });
});

describe('parseBackup', () => {
  it('rejects files that are not a Snap Spend backup', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false });
    expect(parseBackup('{"hello":1}')).toMatchObject({ ok: false });
    expect(
      parseBackup(
        JSON.stringify({
          format: 'snapspend-backup',
          version: 99,
          exportedAt: 1,
          receipts: [],
          storeAliases: [],
        }),
      ),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/newer version/),
    });
  });

  it('rejects money that is not whole forints', () => {
    seedA();
    const data = buildBackup(a, 1);
    data.receipts[0]!.printedTotal = 10.5;
    const r = parseBackup(JSON.stringify(data));
    expect(r.ok).toBe(false);
  });

  it('records when it was made', () => {
    seedA();
    expect(buildBackup(a, 123).exportedAt).toBe(123);
    expect(buildBackup(a, 123).receipts).toHaveLength(6);
  });
});
