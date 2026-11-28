/**
 * The two user-editable lists in Settings (SPEC §2.8, D73): categories and store aliases.
 * Renaming or deleting a category also rewrites the items and receipts that use it, and bumps
 * those receipts' `updatedAt` so the change wins a backup merge / sync (D44).
 */
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';

import { cleanName, FALLBACK_CATEGORY } from '@/lib/categories';
import type { StoreAlias } from '@/lib/normalize';

import { notDeleted } from './repository';
import { categories, items, receipts, storeAliases } from './schema';
import type { AppDatabase } from './types';

type Tx = Pick<AppDatabase, 'select' | 'selectDistinct' | 'insert' | 'update' | 'delete'>;
type Clock = { now?: () => number };

// ---- Categories -------------------------------------------------------------------

export function listCategories(db: Pick<AppDatabase, 'select'>): string[] {
  return db
    .select({ name: categories.name })
    .from(categories)
    .orderBy(asc(categories.position))
    .all()
    .map((r) => r.name);
}

/** Rewrites the whole list in this order (it's short; keeps positions 0..n-1). */
function writeOrder(tx: Tx, names: readonly string[]): void {
  tx.delete(categories).run();
  if (names.length) {
    tx.insert(categories)
      .values(names.map((name, position) => ({ name, position })))
      .run();
  }
}

/** Ids of receipts that use a category, on an item or as the receipt-level category. */
function receiptsUsing(tx: Tx, name: string): string[] {
  const viaItems = tx
    .selectDistinct({ id: items.receiptId })
    .from(items)
    .where(eq(items.category, name))
    .all()
    .map((r) => r.id);
  const direct = tx
    .select({ id: receipts.id })
    .from(receipts)
    .where(eq(receipts.category, name))
    .all()
    .map((r) => r.id);
  return [...new Set([...viaItems, ...direct])];
}

/** Moves every use of `from` to `to`; returns how many live receipts changed. */
function reassign(tx: Tx, from: string, to: string, now: number): number {
  const ids = receiptsUsing(tx, from);
  if (ids.length === 0) return 0;
  tx.update(items).set({ category: to }).where(eq(items.category, from)).run();
  tx.update(receipts).set({ category: to }).where(eq(receipts.category, from)).run();
  tx.update(receipts).set({ updatedAt: now }).where(inArray(receipts.id, ids)).run();
  return tx
    .select({ n: sql<number>`count(*)` })
    .from(receipts)
    .where(and(inArray(receipts.id, ids), notDeleted))
    .get()!.n;
}

/** How many live receipts and their items use a category (for the delete / rename prompt). */
export function categoryUsage(db: AppDatabase, name: string): { receipts: number; items: number } {
  const live = db.select({ id: receipts.id }).from(receipts).where(notDeleted);
  const itemCount = db
    .select({ n: sql<number>`count(*)` })
    .from(items)
    .where(and(eq(items.category, name), inArray(items.receiptId, live)))
    .get()!.n;
  const receiptCount = db
    .select({ n: sql<number>`count(DISTINCT ${receipts.id})` })
    .from(receipts)
    .leftJoin(items, eq(items.receiptId, receipts.id))
    .where(and(notDeleted, or(eq(receipts.category, name), eq(items.category, name))))
    .get()!.n;
  return { receipts: receiptCount, items: itemCount };
}

/** Adds a category just before "Other" (or at the end). The name must already pass checkCategoryName. */
export function addCategory(db: AppDatabase, name: string): string {
  const cleaned = cleanName(name);
  db.transaction((tx) => {
    const list = listCategories(tx);
    const at = list.lastIndexOf(FALLBACK_CATEGORY);
    const next =
      at === -1 ? [...list, cleaned] : [...list.slice(0, at), cleaned, ...list.slice(at)];
    writeOrder(tx, next);
  });
  return cleaned;
}

/**
 * Renames a category in the list and on every item and receipt using it. "Other" can't be renamed.
 * Returns how many live receipts changed.
 */
export function renameCategory(
  db: AppDatabase,
  from: string,
  to: string,
  { now = Date.now }: Clock = {},
): number {
  if (from === FALLBACK_CATEGORY) throw new Error(`"${FALLBACK_CATEGORY}" can't be renamed`);
  const cleaned = cleanName(to);
  return db.transaction((tx) => {
    const list = listCategories(tx);
    if (!list.includes(from)) return 0;
    writeOrder(
      tx,
      list.map((c) => (c === from ? cleaned : c)),
    );
    return cleaned === from ? 0 : reassign(tx, from, cleaned, now());
  });
}

/**
 * Removes a category; its items and receipts move to "Other", which can't be deleted.
 * Returns how many live receipts changed.
 */
export function deleteCategory(
  db: AppDatabase,
  name: string,
  { now = Date.now }: Clock = {},
): number {
  if (name === FALLBACK_CATEGORY) throw new Error(`"${FALLBACK_CATEGORY}" can't be deleted`);
  return db.transaction((tx) => {
    const list = listCategories(tx);
    if (!list.includes(name)) return 0;
    const rest = list.filter((c) => c !== name);
    writeOrder(tx, rest.includes(FALLBACK_CATEGORY) ? rest : [...rest, FALLBACK_CATEGORY]);
    return reassign(tx, name, FALLBACK_CATEGORY, now());
  });
}

/** Moves a category one place up (-1) or down (+1). Returns false at either end. */
export function moveCategory(db: AppDatabase, name: string, delta: -1 | 1): boolean {
  return db.transaction((tx) => {
    const list = listCategories(tx);
    const i = list.indexOf(name);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= list.length) return false;
    [list[i], list[j]] = [list[j]!, list[i]!];
    writeOrder(tx, list);
    return true;
  });
}

/** Adds any of these names that aren't in the list yet (case-insensitive), before "Other". */
export function addMissingCategories(tx: Tx, names: readonly string[]): number {
  const list = listCategories(tx);
  const known = new Set(list.map((c) => c.toLowerCase()));
  const extra: string[] = [];
  for (const n of names.map(cleanName)) {
    if (n && !known.has(n.toLowerCase())) {
      known.add(n.toLowerCase());
      extra.push(n);
    }
  }
  if (extra.length === 0) return 0;
  const at = list.lastIndexOf(FALLBACK_CATEGORY);
  writeOrder(
    tx,
    at === -1 ? [...list, ...extra] : [...list.slice(0, at), ...extra, ...list.slice(at)],
  );
  return extra.length;
}

// ---- Store aliases ------------------------------------------------------------------

export function listStoreAliases(db: Pick<AppDatabase, 'select'>): StoreAlias[] {
  return db
    .select()
    .from(storeAliases)
    .orderBy(sql`${storeAliases.raw} COLLATE NOCASE`)
    .all();
}

/**
 * Adds or edits an alias (both names cleaned). `previousRaw` is the alias being edited, so its
 * printed name can change too. The alias must already pass checkStoreAlias.
 */
export function saveStoreAlias(
  db: AppDatabase,
  alias: StoreAlias,
  previousRaw?: string,
): StoreAlias {
  const row = { raw: cleanName(alias.raw), canonical: cleanName(alias.canonical) };
  db.transaction((tx) => {
    if (previousRaw !== undefined)
      tx.delete(storeAliases).where(eq(storeAliases.raw, previousRaw)).run();
    tx.insert(storeAliases)
      .values(row)
      .onConflictDoUpdate({ target: storeAliases.raw, set: { canonical: row.canonical } })
      .run();
  });
  return row;
}

export function deleteStoreAlias(db: AppDatabase, raw: string): void {
  db.delete(storeAliases).where(eq(storeAliases.raw, raw)).run();
}

/** Live receipts whose store is exactly `raw` (ignoring case and extra spaces). */
function receiptsWithStore(tx: Tx, raw: string): string[] {
  const key = cleanName(raw).toLowerCase();
  return tx
    .select({ id: receipts.id, store: receipts.store })
    .from(receipts)
    .where(notDeleted)
    .all()
    .filter((r) => cleanName(r.store).toLowerCase() === key)
    .map((r) => r.id);
}

export function countReceiptsWithStore(db: AppDatabase, raw: string): number {
  return receiptsWithStore(db, raw).length;
}

/** Renames the store on saved receipts that still use the printed name. Returns how many changed. */
export function applyAliasToReceipts(
  db: AppDatabase,
  alias: StoreAlias,
  { now = Date.now }: Clock = {},
): number {
  return db.transaction((tx) => {
    const ids = receiptsWithStore(tx, alias.raw);
    if (ids.length) {
      tx.update(receipts)
        .set({ store: cleanName(alias.canonical), updatedAt: now() })
        .where(inArray(receipts.id, ids))
        .run();
    }
    return ids.length;
  });
}
