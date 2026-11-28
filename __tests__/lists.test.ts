/**
 * @jest-environment node
 */
import {
  addCategory,
  applyAliasToReceipts,
  categoryUsage,
  countReceiptsWithStore,
  deleteCategory,
  deleteStoreAlias,
  listCategories,
  listStoreAliases,
  moveCategory,
  renameCategory,
  saveStoreAlias,
} from '@/db/lists';
import {
  createReceiptWithItems,
  deleteReceipt,
  getReceipt,
  type ReceiptInput,
} from '@/db/repository';
import type { AppDatabase } from '@/db/types';
import { checkCategoryName, DEFAULT_CATEGORIES } from '@/lib/categories';
import { checkStoreAlias } from '@/lib/normalize';

import { createTestDb, testDeps } from './helpers/testDb';

let db: AppDatabase;
beforeEach(async () => {
  db = await createTestDb();
});

const receipt = (over: Partial<ReceiptInput> = {}): ReceiptInput => ({
  kind: 'scanned',
  store: 'TESCO',
  date: '2026-11-20',
  printedTotal: 500,
  items: [
    { nameEn: 'Bread', quantity: 1, unit: 'pcs', lineTotal: 300, category: 'Bakery' },
    { nameEn: 'Milk', quantity: 1, unit: 'pcs', lineTotal: 200, category: 'Dairy & Eggs' },
  ],
  adjustments: [],
  ...over,
});

describe('category list (D73)', () => {
  it('starts with the SPEC §3 defaults in order', () => {
    expect(listCategories(db)).toEqual([...DEFAULT_CATEGORIES]);
  });

  it('adds a new category just before Other, with whitespace cleaned', () => {
    expect(addCategory(db, '  Pet   food ')).toBe('Pet food');
    expect(listCategories(db).slice(-2)).toEqual(['Pet food', 'Other']);
  });

  it('moves categories up and down, and stops at the ends', () => {
    expect(moveCategory(db, 'Bakery', -1)).toBe(true);
    expect(listCategories(db).slice(0, 2)).toEqual(['Bakery', 'Dairy & Eggs']);
    expect(moveCategory(db, 'Bakery', -1)).toBe(false);
    expect(moveCategory(db, 'Other', 1)).toBe(false);
    expect(moveCategory(db, 'Nope', 1)).toBe(false);
  });

  it('rename updates the list, items and receipt categories, and bumps updatedAt', () => {
    const deps = testDeps(1_000);
    const id = createReceiptWithItems(db, receipt(), deps);
    const manual = createReceiptWithItems(
      db,
      receipt({ kind: 'manual', items: [], category: 'Bakery', store: 'Pék' }),
      deps,
    );
    const other = createReceiptWithItems(
      db,
      receipt({
        items: [
          {
            nameEn: 'Soap',
            quantity: 1,
            unit: 'pcs',
            lineTotal: 500,
            category: 'Household & Cleaning',
          },
        ],
      }),
      deps,
    );

    expect(renameCategory(db, 'Bakery', 'Bread & Pastry', { now: () => 5_000 })).toBe(2);
    expect(listCategories(db)[1]).toBe('Bread & Pastry');
    expect(listCategories(db)).not.toContain('Bakery');
    expect(getReceipt(db, id)!.items.map((i) => i.category)).toEqual([
      'Bread & Pastry',
      'Dairy & Eggs',
    ]);
    expect(getReceipt(db, id)!.updatedAt).toBe(5_000);
    expect(getReceipt(db, manual)!.category).toBe('Bread & Pastry');
    expect(getReceipt(db, other)!.updatedAt).toBeLessThan(5_000);
  });

  it('a case-only rename keeps the data and changes nothing else', () => {
    createReceiptWithItems(db, receipt(), testDeps());
    expect(renameCategory(db, 'Pantry', 'PANTRY')).toBe(0);
    expect(listCategories(db)[4]).toBe('PANTRY');
  });

  it('delete moves its items and receipts to Other', () => {
    const id = createReceiptWithItems(db, receipt(), testDeps());
    expect(deleteCategory(db, 'Bakery', { now: () => 7_000 })).toBe(1);
    expect(listCategories(db)).not.toContain('Bakery');
    expect(listCategories(db).at(-1)).toBe('Other');
    expect(getReceipt(db, id)!.items[0]!.category).toBe('Other');
    expect(getReceipt(db, id)!.updatedAt).toBe(7_000);
  });

  it('Other cannot be renamed or deleted', () => {
    expect(() => renameCategory(db, 'Other', 'Misc')).toThrow();
    expect(() => deleteCategory(db, 'Other')).toThrow();
    expect(listCategories(db)).toContain('Other');
  });

  it('usage counts live receipts and their items only', () => {
    const deps = testDeps();
    createReceiptWithItems(db, receipt(), deps);
    const gone = createReceiptWithItems(db, receipt(), deps);
    createReceiptWithItems(db, receipt({ kind: 'manual', items: [], category: 'Bakery' }), deps);
    deleteReceipt(db, gone);
    expect(categoryUsage(db, 'Bakery')).toEqual({ receipts: 2, items: 1 });
    expect(categoryUsage(db, 'Frozen')).toEqual({ receipts: 0, items: 0 });
  });
});

describe('checkCategoryName', () => {
  const list = ['Bakery', 'Other'];
  it('accepts a new name and the current name re-cased', () => {
    expect(checkCategoryName('Pets', list)).toBeNull();
    expect(checkCategoryName('BAKERY', list, 'Bakery')).toBeNull();
  });
  it('rejects empty, too long and duplicate names (case-insensitive)', () => {
    expect(checkCategoryName('   ', list)).toMatch(/Enter/);
    expect(checkCategoryName('x'.repeat(41), list)).toMatch(/40/);
    expect(checkCategoryName(' bakery ', list)).toMatch(/already exists/);
    expect(checkCategoryName('other', list, 'Bakery')).toMatch(/already exists/);
  });
});

describe('store aliases', () => {
  it('starts with the default INTERSPAR alias', () => {
    expect(listStoreAliases(db)).toEqual([{ raw: 'INTERSPAR', canonical: 'SPAR (Interspar)' }]);
  });

  it('adds, edits (including the printed name) and deletes aliases, sorted A–Z', () => {
    saveStoreAlias(db, { raw: ' TESCO  GLOBAL ', canonical: 'TESCO' });
    saveStoreAlias(db, { raw: 'aldi magyarország', canonical: 'ALDI' });
    expect(listStoreAliases(db).map((a) => a.raw)).toEqual([
      'aldi magyarország',
      'INTERSPAR',
      'TESCO GLOBAL',
    ]);
    saveStoreAlias(db, { raw: 'ALDI MAGYARORSZÁG', canonical: 'Aldi' }, 'aldi magyarország');
    expect(listStoreAliases(db)[0]).toEqual({ raw: 'ALDI MAGYARORSZÁG', canonical: 'Aldi' });
    expect(listStoreAliases(db)).toHaveLength(3);
    deleteStoreAlias(db, 'INTERSPAR');
    expect(listStoreAliases(db).map((a) => a.raw)).toEqual(['ALDI MAGYARORSZÁG', 'TESCO GLOBAL']);
  });

  it('renames saved receipts that still use the printed name (live ones only)', () => {
    const deps = testDeps(1_000);
    const a = createReceiptWithItems(db, receipt({ store: 'Tesco  Global' }), deps);
    const b = createReceiptWithItems(db, receipt({ store: 'TESCO GLOBAL' }), deps);
    const gone = createReceiptWithItems(db, receipt({ store: 'TESCO GLOBAL' }), deps);
    const keep = createReceiptWithItems(db, receipt({ store: 'TESCO EXPRESS' }), deps);
    deleteReceipt(db, gone);

    expect(countReceiptsWithStore(db, 'tesco global')).toBe(2);
    expect(
      applyAliasToReceipts(db, { raw: 'TESCO GLOBAL', canonical: 'TESCO' }, { now: () => 9_000 }),
    ).toBe(2);
    expect(getReceipt(db, a)!.store).toBe('TESCO');
    expect(getReceipt(db, b)!.updatedAt).toBe(9_000);
    expect(getReceipt(db, keep)!.store).toBe('TESCO EXPRESS');
    expect(countReceiptsWithStore(db, 'TESCO GLOBAL')).toBe(0);
  });
});

describe('checkStoreAlias', () => {
  const existing = [{ raw: 'INTERSPAR', canonical: 'SPAR (Interspar)' }];
  it('accepts a valid new alias and the alias being edited', () => {
    expect(checkStoreAlias('TESCO GLOBAL', 'TESCO', existing)).toBeNull();
    expect(checkStoreAlias('interspar', 'SPAR', existing, 'INTERSPAR')).toBeNull();
  });
  it('reports missing names, same names and duplicates', () => {
    expect(checkStoreAlias(' ', '', existing)).toEqual({
      raw: expect.any(String),
      canonical: expect.any(String),
    });
    expect(checkStoreAlias('SPAR', 'spar', existing)).toEqual({
      canonical: 'Same as the printed name',
    });
    expect(checkStoreAlias(' interspar ', 'X', existing)).toEqual({
      raw: 'Already mapped to "SPAR (Interspar)"',
    });
  });
});
