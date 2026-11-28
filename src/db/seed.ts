/**
 * Dev-only sample data: loads the SPEC §6 golden receipts so screens have something to show.
 * Seeded receipts are tagged with SEED_NOTE so they can be removed without touching real data.
 */
import { and, count, eq } from 'drizzle-orm';

import { createReceiptWithItems, notDeleted, type RepoDeps } from './repository';
import { receipts } from './schema';
import { seedReceipts } from './seedData';
import type { AppDatabase } from './types';

export const SEED_NOTE = '[sample data]';

/** Inserts the sample receipts unless they're already there. Returns how many were added. */
export function seedSampleData(db: AppDatabase, deps?: RepoDeps): number {
  if (countSampleReceipts(db) > 0) return 0;
  // Nested calls run on the transaction handle, so drizzle uses savepoints: all or nothing.
  db.transaction((tx) => {
    for (const r of seedReceipts) createReceiptWithItems(tx, { ...r, note: SEED_NOTE }, deps);
  });
  return seedReceipts.length;
}

/**
 * Hard-deletes only the sample receipts, including soft-deleted ones (and, by cascade, their items).
 * Sample data is dev-only and never synced, so it doesn't need a soft delete. Returns how many were removed.
 */
export function clearSampleData(db: AppDatabase): number {
  return db
    .delete(receipts)
    .where(eq(receipts.note, SEED_NOTE))
    .returning({ id: receipts.id })
    .all().length;
}

/** Live (not deleted) sample receipts. */
export function countSampleReceipts(db: AppDatabase): number {
  return (
    db
      .select({ n: count() })
      .from(receipts)
      .where(and(eq(receipts.note, SEED_NOTE), notDeleted))
      .get()?.n ?? 0
  );
}
