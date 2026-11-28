/**
 * JSON backup (Phase 8, D72). The backup holds every receipt, including soft-deleted ones (so a
 * delete reaches the other phone), with items, adjustments and store aliases. Receipt photos
 * are not included; the category list is (D73). Import **merges** (D44): a receipt is added if missing, replaced if the
 * backup's copy has a newer `updatedAt`, otherwise left alone. Store aliases are added when
 * missing; local ones are kept.
 */
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { addMissingCategories, listCategories } from './lists';
import { adjustments, items, receipts, storeAliases } from './schema';
import type { AppDatabase } from './types';

export const BACKUP_FORMAT = 'snapspend-backup';
export const BACKUP_VERSION = 1;

const int = z.number().int();
const nullableText = z.string().nullable();

const itemSchema = z.object({
  id: z.string().min(1),
  position: int,
  nameEn: z.string(),
  nameOriginal: nullableText,
  sizeLabel: nullableText,
  quantity: z.number(),
  unit: z.enum(['pcs', 'kg']),
  unitPrice: int.nullable(),
  lineTotal: int,
  category: z.string(),
  normalizedKey: z.string(),
});

const adjustmentSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['discount', 'charge', 'points']),
  label: z.string(),
  amount: int,
  appliesTo: nullableText,
});

const receiptSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['scanned', 'total_only', 'manual']),
  store: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: nullableText,
  printedTotal: int,
  computedTotal: int,
  cardLast4: nullableText,
  paymentMethod: nullableText,
  imagePaths: nullableText,
  rawGeminiJson: nullableText,
  note: nullableText,
  category: nullableText,
  createdAt: int,
  updatedAt: int,
  deletedAt: int.nullable(),
  items: z.array(itemSchema),
  adjustments: z.array(adjustmentSchema),
});

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: int,
  receipts: z.array(receiptSchema),
  storeAliases: z.array(z.object({ raw: z.string(), canonical: z.string() })),
  /** The category list in order (D73). Optional: older v1 backups don't have it. */
  categories: z.array(z.string()).optional(),
});

export type Backup = z.infer<typeof backupSchema>;

export function buildBackup(db: AppDatabase, now: number = Date.now()): Backup {
  const rows = db
    .select()
    .from(receipts)
    .orderBy(asc(receipts.date), asc(receipts.createdAt))
    .all();
  const itemRows = db.select().from(items).orderBy(asc(items.receiptId), asc(items.position)).all();
  const adjRows = db.select().from(adjustments).all();
  const byReceipt = new Map(
    rows.map((r) => [
      r.id,
      {
        ...r,
        items: [] as Backup['receipts'][number]['items'],
        adjustments: [] as Backup['receipts'][number]['adjustments'],
      },
    ]),
  );
  for (const { receiptId, ...it } of itemRows) byReceipt.get(receiptId)?.items.push(it);
  for (const { receiptId, ...a } of adjRows) byReceipt.get(receiptId)?.adjustments.push(a);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    receipts: [...byReceipt.values()],
    storeAliases: db.select().from(storeAliases).all(),
    categories: listCategories(db),
  };
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  const v = value as { format?: unknown; version?: unknown };
  if (v?.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This file is not a Snap Spend backup.' };
  }
  if (typeof v.version === 'number' && v.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of Snap Spend.' };
  }
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: `The backup file is damaged (${first ? `${first.path.join('.')}: ${first.message}` : 'invalid'}).`,
    };
  }
  return { ok: true, backup: parsed.data };
}

export interface MergeResult {
  added: number;
  updated: number;
  unchanged: number;
}

/** Merges a parsed backup into the database in one transaction. */
export function mergeBackup(db: AppDatabase, backup: Backup): MergeResult {
  const result: MergeResult = { added: 0, updated: 0, unchanged: 0 };
  db.transaction((tx) => {
    for (const { items: itemList, adjustments: adjList, ...row } of backup.receipts) {
      const local = tx
        .select({ updatedAt: receipts.updatedAt })
        .from(receipts)
        .where(eq(receipts.id, row.id))
        .get();
      if (local && local.updatedAt >= row.updatedAt) {
        result.unchanged += 1;
        continue;
      }
      if (local) {
        const { id, ...fields } = row;
        tx.update(receipts).set(fields).where(eq(receipts.id, id)).run();
        tx.delete(items).where(eq(items.receiptId, id)).run();
        tx.delete(adjustments).where(eq(adjustments.receiptId, id)).run();
        result.updated += 1;
      } else {
        tx.insert(receipts).values(row).run();
        result.added += 1;
      }
      if (itemList.length) {
        tx.insert(items)
          .values(itemList.map((it) => ({ ...it, receiptId: row.id })))
          .run();
      }
      if (adjList.length) {
        tx.insert(adjustments)
          .values(adjList.map((a) => ({ ...a, receiptId: row.id })))
          .run();
      }
    }
    for (const alias of backup.storeAliases) {
      tx.insert(storeAliases).values(alias).onConflictDoNothing().run();
    }
    // Categories missing here are added (local list and order win), including any that the
    // backup's items use but its list doesn't have, so every item's category is in the list.
    const used = backup.receipts.flatMap((r) => [
      ...(r.category ? [r.category] : []),
      ...r.items.map((it) => it.category),
    ]);
    addMissingCategories(tx, [...(backup.categories ?? []), ...used]);
  });
  return result;
}
