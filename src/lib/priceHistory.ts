/**
 * Items tracker maths (SPEC §2.5): filtered totals and per-product price history
 * (unit price over time, cheapest store, last paid). Pure; rows come from `listItems`.
 */
import type { ItemUnit } from './types';

export interface PricedRow {
  date: string;
  time: string | null;
  store: string;
  quantity: number;
  unit: ItemUnit;
  unitPrice: number | null;
  lineTotal: number;
}

export interface PricePoint {
  date: string;
  time: string | null;
  store: string;
  /** Ft per pcs or per kg. */
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface PriceHistory {
  unit: ItemUnit;
  /** Oldest first. */
  points: PricePoint[];
  last: PricePoint;
  /** Lowest unit price; the most recent one wins a tie. */
  cheapest: PricePoint;
  /** Mean unit price, rounded to whole forints. */
  average: number;
  timesBought: number;
  totalSpent: number;
}

/** The printed unit price, or line total ÷ quantity when none was printed. */
export function effectiveUnitPrice(
  r: Pick<PricedRow, 'unitPrice' | 'lineTotal' | 'quantity'>,
): number {
  return r.unitPrice ?? Math.round(r.lineTotal / r.quantity);
}

const chronological = (a: PricePoint, b: PricePoint) =>
  a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '');

/**
 * Price history for one product (rows sharing a normalizedKey). Returned items are skipped.
 * If the product was bought both per piece and per kg, only the unit of the latest purchase is used.
 */
export function priceHistory(rows: readonly PricedRow[]): PriceHistory | null {
  const bought = rows.filter((r) => r.lineTotal > 0 && r.quantity > 0);
  if (bought.length === 0) return null;

  const all = bought
    .map((r) => ({ point: toPoint(r), unit: r.unit }))
    .sort((a, b) => chronological(a.point, b.point));
  const unit = all[all.length - 1]!.unit;
  const points = all.filter((p) => p.unit === unit).map((p) => p.point);

  let cheapest = points[0]!;
  for (const p of points) if (p.price <= cheapest.price) cheapest = p;

  const sum = points.reduce((s, p) => s + p.price, 0);
  return {
    unit,
    points,
    last: points[points.length - 1]!,
    cheapest,
    average: Math.round(sum / points.length),
    timesBought: points.length,
    totalSpent: points.reduce((s, p) => s + p.lineTotal, 0),
  };
}

function toPoint(r: PricedRow): PricePoint {
  return {
    date: r.date,
    time: r.time,
    store: r.store,
    price: effectiveUnitPrice(r),
    quantity: r.quantity,
    lineTotal: r.lineTotal,
  };
}

/** Footer total of the Items list (returns count as negative). */
export function sumLineTotals(rows: readonly { lineTotal: number }[]): number {
  return rows.reduce((s, r) => s + r.lineTotal, 0);
}
