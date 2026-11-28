/**
 * SQLite schema (SPEC §4). Money columns are integer forints; quantities are REAL.
 * After changing this file run `npm run db:generate` to create a migration.
 */
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const receipts = sqliteTable(
  'receipts',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['scanned', 'total_only', 'manual'] }).notNull(),
    store: text('store').notNull(),
    /** ISO `YYYY-MM-DD`. */
    date: text('date').notNull(),
    /** `HH:MM`. */
    time: text('time'),
    printedTotal: integer('printed_total').notNull(),
    computedTotal: integer('computed_total').notNull(),
    cardLast4: text('card_last4'),
    paymentMethod: text('payment_method'),
    /** JSON array of file URIs. */
    imagePaths: text('image_paths'),
    rawGeminiJson: text('raw_gemini_json'),
    note: text('note'),
    /** Optional receipt-level category for manual / total-only entries (D55); items carry their own. */
    category: text('category'),
    /** Epoch ms. */
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    /** Epoch ms when soft-deleted (D44); null = live. Deleted rows are kept so the delete can sync. */
    deletedAt: integer('deleted_at'),
  },
  (t) => [index('receipts_date_idx').on(t.date)],
);

export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    receiptId: text('receipt_id')
      .notNull()
      .references(() => receipts.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    nameEn: text('name_en').notNull(),
    nameOriginal: text('name_original'),
    sizeLabel: text('size_label'),
    quantity: real('quantity').notNull(),
    unit: text('unit', { enum: ['pcs', 'kg'] }).notNull(),
    unitPrice: integer('unit_price'),
    lineTotal: integer('line_total').notNull(),
    category: text('category').notNull(),
    normalizedKey: text('normalized_key').notNull(),
  },
  (t) => [
    index('items_receipt_id_idx').on(t.receiptId),
    index('items_normalized_key_idx').on(t.normalizedKey),
    index('items_category_idx').on(t.category),
  ],
);

export const adjustments = sqliteTable(
  'adjustments',
  {
    id: text('id').primaryKey(),
    receiptId: text('receipt_id')
      .notNull()
      .references(() => receipts.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['discount', 'charge', 'points'] }).notNull(),
    label: text('label').notNull(),
    /** Positive integer Ft; sign implied by `type`. */
    amount: integer('amount').notNull(),
    appliesTo: text('applies_to'),
  },
  (t) => [index('adjustments_receipt_id_idx').on(t.receiptId)],
);

export const storeAliases = sqliteTable('store_aliases', {
  raw: text('raw').primaryKey(),
  canonical: text('canonical').notNull(),
});

export type ReceiptRow = typeof receipts.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type AdjustmentRow = typeof adjustments.$inferSelect;
