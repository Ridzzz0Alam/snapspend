/**
 * Receipt repository. Thin data access only; totals, keys and formatting come from src/lib.
 * Every function takes the database as its first argument so tests can pass an in-memory one.
 */
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';

import { FALLBACK_CATEGORY } from '@/lib/categories';
import { normalizedKey } from '@/lib/normalize';
import { matchesSearch } from '@/lib/search';
import { computedTotal } from '@/lib/totals';
import type { Adjustment, ItemUnit, ReceiptKind } from '@/lib/types';

import { newId as defaultNewId } from './ids';
import {
  adjustments,
  items,
  receipts,
  type AdjustmentRow,
  type ItemRow,
  type ReceiptRow,
} from './schema';
import type { AppDatabase } from './types';

// ---- Input / output shapes ----------------------------------------------------

export interface ItemInput {
  nameEn: string;
  nameOriginal?: string | null;
  sizeLabel?: string | null;
  quantity: number;
  unit: ItemUnit;
  unitPrice?: number | null;
  lineTotal: number;
  category?: string | null;
}

export interface ReceiptInput {
  kind: ReceiptKind;
  store: string;
  date: string;
  time?: string | null;
  printedTotal: number;
  cardLast4?: string | null;
  paymentMethod?: string | null;
  imagePaths?: string[] | null;
  rawGeminiJson?: string | null;
  note?: string | null;
  /** Receipt-level category (manual / total-only entries, D55). */
  category?: string | null;
  items: ItemInput[];
  adjustments: Adjustment[];
}

/** A receipt with its items (in receipt order) and adjustments. Works directly with formatDailyLog. */
export interface StoredReceipt extends ReceiptRow {
  items: ItemRow[];
  adjustments: AdjustmentRow[];
}

export interface RepoDeps {
  newId?: () => string;
  now?: () => number;
  /** Use this id for the new receipt (e.g. its images were already saved under it). */
  receiptId?: string;
}

/** Rows that haven't been soft-deleted. Every read and total must include this. */
export const notDeleted = isNull(receipts.deletedAt);

// ---- Writes ---------------------------------------------------------------------

function itemRows(receiptId: string, input: ItemInput[], newId: () => string): ItemRow[] {
  return input.map((it, position) => ({
    id: newId(),
    receiptId,
    position,
    nameEn: it.nameEn,
    nameOriginal: it.nameOriginal ?? null,
    sizeLabel: it.sizeLabel ?? null,
    quantity: it.quantity,
    unit: it.unit,
    unitPrice: it.unitPrice ?? null,
    lineTotal: it.lineTotal,
    category: it.category || FALLBACK_CATEGORY,
    normalizedKey: normalizedKey(it.nameEn, it.sizeLabel),
  }));
}

function adjustmentRows(
  receiptId: string,
  input: Adjustment[],
  newId: () => string,
): AdjustmentRow[] {
  return input.map((a) => ({
    id: newId(),
    receiptId,
    type: a.type,
    label: a.label,
    amount: a.amount,
    appliesTo: a.appliesTo ?? null,
  }));
}

function receiptFields(input: ReceiptInput) {
  return {
    kind: input.kind,
    store: input.store,
    date: input.date,
    time: input.time ?? null,
    printedTotal: input.printedTotal,
    computedTotal: computedTotal(input.items, input.adjustments),
    cardLast4: input.cardLast4 ?? null,
    paymentMethod: input.paymentMethod ?? null,
    imagePaths: input.imagePaths ? JSON.stringify(input.imagePaths) : null,
    rawGeminiJson: input.rawGeminiJson ?? null,
    note: input.note ?? null,
    category: input.category ?? null,
  };
}

function insertChildren(
  tx: Pick<AppDatabase, 'insert'>,
  receiptId: string,
  input: ReceiptInput,
  newId: () => string,
): void {
  const itemValues = itemRows(receiptId, input.items, newId);
  if (itemValues.length) tx.insert(items).values(itemValues).run();
  const adjValues = adjustmentRows(receiptId, input.adjustments, newId);
  if (adjValues.length) tx.insert(adjustments).values(adjValues).run();
}

/** Inserts a receipt with its items and adjustments in one transaction. Returns the new id. */
export function createReceiptWithItems(
  db: AppDatabase,
  input: ReceiptInput,
  { newId = defaultNewId, now = Date.now, receiptId }: RepoDeps = {},
): string {
  const id = receiptId ?? newId();
  const ts = now();
  db.transaction((tx) => {
    tx.insert(receipts)
      .values({ id, ...receiptFields(input), createdAt: ts, updatedAt: ts })
      .run();
    insertChildren(tx, id, input, newId);
  });
  return id;
}

/**
 * Replaces a receipt's fields, items and adjustments (the Review / Detail screens edit everything at once).
 * Keeps `createdAt`. Returns false if the receipt doesn't exist or was deleted.
 */
export function updateReceipt(
  db: AppDatabase,
  id: string,
  input: ReceiptInput,
  { newId = defaultNewId, now = Date.now }: RepoDeps = {},
): boolean {
  return db.transaction((tx) => {
    const existing = tx
      .select({ id: receipts.id })
      .from(receipts)
      .where(and(eq(receipts.id, id), notDeleted))
      .get();
    if (!existing) return false;
    tx.update(receipts)
      .set({ ...receiptFields(input), updatedAt: now() })
      .where(eq(receipts.id, id))
      .run();
    tx.delete(items).where(eq(items.receiptId, id)).run();
    tx.delete(adjustments).where(eq(adjustments.receiptId, id)).run();
    insertChildren(tx, id, input, newId);
    return true;
  });
}

/**
 * Soft-deletes a receipt (D44): sets `deletedAt` and `updatedAt`, keeps the row, items and adjustments
 * so the delete can sync to the other phone. Returns false if not found or already deleted.
 */
export function deleteReceipt(
  db: AppDatabase,
  id: string,
  { now = Date.now }: Pick<RepoDeps, 'now'> = {},
): boolean {
  const ts = now();
  const deleted = db
    .update(receipts)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(receipts.id, id), notDeleted))
    .returning({ id: receipts.id })
    .all();
  return deleted.length > 0;
}

// ---- Reads ----------------------------------------------------------------------

/** Live receipts with `from <= date <= to` (ISO dates, inclusive), ordered by date, time, createdAt. */
export function listByDateRange(db: AppDatabase, from: string, to: string): StoredReceipt[] {
  const inRange = and(gte(receipts.date, from), lte(receipts.date, to), notDeleted);
  const rows = db
    .select()
    .from(receipts)
    .where(inRange)
    .orderBy(
      asc(receipts.date),
      sql`${receipts.time} IS NULL`,
      asc(receipts.time),
      asc(receipts.createdAt),
    )
    .all();
  if (rows.length === 0) return [];

  const idsInRange = db.select({ id: receipts.id }).from(receipts).where(inRange);
  const itemList = db
    .select()
    .from(items)
    .where(inArray(items.receiptId, idsInRange))
    .orderBy(asc(items.receiptId), asc(items.position))
    .all();
  const adjList = db
    .select()
    .from(adjustments)
    .where(inArray(adjustments.receiptId, idsInRange))
    .all();

  const byId = new Map<string, StoredReceipt>(
    rows.map((r) => [r.id, { ...r, items: [], adjustments: [] }]),
  );
  for (const it of itemList) byId.get(it.receiptId)?.items.push(it);
  for (const a of adjList) byId.get(a.receiptId)?.adjustments.push(a);
  return [...byId.values()];
}

/**
 * Live receipts with the same store (case/space-insensitive), date and printed total (D19).
 * The Review screen warns about these; it never blocks the save.
 */
export function findDuplicates(
  db: AppDatabase,
  probe: { store: string; date: string; printedTotal: number },
  { excludeId }: { excludeId?: string } = {},
): ReceiptRow[] {
  const store = probe.store.trim().replace(/\s+/g, ' ').toLowerCase();
  return db
    .select()
    .from(receipts)
    .where(
      and(
        notDeleted,
        eq(receipts.date, probe.date),
        eq(receipts.printedTotal, probe.printedTotal),
        sql`lower(trim(${receipts.store})) = ${store}`,
        excludeId ? sql`${receipts.id} <> ${excludeId}` : undefined,
      ),
    )
    .all();
}

export type ItemSortKey = 'date' | 'amount' | 'name' | 'store' | 'category';

export interface ItemFilters {
  from?: string;
  to?: string;
  stores?: string[];
  categories?: string[];
  /** Matches English and original names; case- and accent-insensitive. */
  search?: string;
}

export interface ItemSort {
  by: ItemSortKey;
  dir?: 'asc' | 'desc';
}

/** An item joined with the receipt fields the tracker shows. */
export interface ItemListRow extends ItemRow {
  date: string;
  time: string | null;
  store: string;
}

/** Flat list of items across receipts for the Items tracker (SPEC §2.5). Default: newest first. */
export function listItems(
  db: AppDatabase,
  filters: ItemFilters = {},
  sort: ItemSort = { by: 'date', dir: 'desc' },
): ItemListRow[] {
  const where: SQL[] = [notDeleted];
  if (filters.from) where.push(gte(receipts.date, filters.from));
  if (filters.to) where.push(lte(receipts.date, filters.to));
  if (filters.stores?.length) where.push(inArray(receipts.store, filters.stores));
  if (filters.categories?.length) where.push(inArray(items.category, filters.categories));

  const dir = sort.dir ?? (sort.by === 'date' || sort.by === 'amount' ? 'desc' : 'asc');
  const order = dir === 'asc' ? asc : desc;
  const primary: SQL[] = {
    date: [] as SQL[],
    amount: [order(items.lineTotal)],
    name: [order(sql`${items.nameEn} COLLATE NOCASE`)],
    store: [order(sql`${receipts.store} COLLATE NOCASE`)],
    category: [order(items.category)],
  }[sort.by];
  // Date order (also the tie-breaker): date, then time, then position on the receipt.
  const dateOrder = sort.by === 'date' ? order : desc;
  const tieBreak = [
    dateOrder(receipts.date),
    dateOrder(receipts.time),
    dateOrder(receipts.createdAt),
    asc(items.position),
  ];

  const rows = db
    .select({ item: items, date: receipts.date, time: receipts.time, store: receipts.store })
    .from(items)
    .innerJoin(receipts, eq(items.receiptId, receipts.id))
    .where(and(...where))
    .orderBy(...primary, ...tieBreak)
    .all()
    .map(({ item, date, time, store }) => ({ ...item, date, time, store }));

  const search = filters.search?.trim();
  return search ? rows.filter((r) => matchesSearch([r.nameEn, r.nameOriginal], search)) : rows;
}
