/**
 * Dev-only sample data: loads the SPEC §6 golden receipts so screens have something to show.
 * Seeded receipts are tagged with SEED_NOTE so they can be removed without touching real data.
 */
import { count, eq } from 'drizzle-orm';

import { createReceiptWithItems, type RepoDeps } from './repository';
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

/** Deletes only the sample receipts (and, by cascade, their items). Returns how many were removed. */
export function clearSampleData(db: AppDatabase): number {
  return db
    .delete(receipts)
    .where(eq(receipts.note, SEED_NOTE))
    .returning({ id: receipts.id })
    .all().length;
}

export function countSampleReceipts(db: AppDatabase): number {
  return db.select({ n: count() }).from(receipts).where(eq(receipts.note, SEED_NOTE)).get()?.n ?? 0;
}
