/**
 * Plain data shapes used by the pure logic in `src/lib`. They mirror SPEC §4 but stay independent of
 * the database layer, so formatting and totals can be tested without SQLite.
 */

export type ReceiptKind = 'scanned' | 'total_only' | 'manual';
export type ItemUnit = 'pcs' | 'kg';
export type AdjustmentType = 'discount' | 'charge' | 'points';

export interface LineItem {
  nameEn: string;
  nameOriginal?: string | null;
  sizeLabel?: string | null;
  /** 2, 0.792 */
  quantity: number;
  unit: ItemUnit;
  /** Ft per pcs or per kg. */
  unitPrice?: number | null;
  /** Ft, integer. */
  lineTotal: number;
  category?: string;
}

export interface Adjustment {
  type: AdjustmentType;
  label: string;
  /** Positive integer Ft; sign implied by `type`. */
  amount: number;
  appliesTo?: string | null;
}

export interface ReceiptData {
  kind: ReceiptKind;
  store: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** `HH:MM`. */
  time?: string | null;
  /** Ft, integer. */
  printedTotal: number;
  items: LineItem[];
  adjustments: Adjustment[];
  /** Epoch ms; tie-breaker for ordering receipts within a day. */
  createdAt?: number;
}
