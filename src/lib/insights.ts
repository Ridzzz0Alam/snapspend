/**
 * Insights maths (SPEC §2.6) and the Home totals: monthly totals, spending by store / category /
 * card, and the most-bought items. Pure; receipts come from `listByDateRange`.
 */
import { FALLBACK_CATEGORY } from './categories';
import { normalizedKey } from './normalize';
import { effectiveUnitPrice } from './priceHistory';
import { computedTotal, receiptTotal } from './totals';
import type { ItemUnit, ReceiptData } from './types';

export interface InsightReceipt extends ReceiptData {
  cardLast4?: string | null;
  /** Receipt-level category (manual / total-only, D55). */
  category?: string | null;
}

export interface LabelTotal {
  label: string;
  total: number;
}

/** Net receipt-level discounts and charges in the category breakdown, so categories add up. */
export const ADJUSTMENTS_LABEL = 'Discounts & charges';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `YYYY-MM` keys for the `n` months ending with `today`'s month, oldest first. */
export function lastNMonths(today: string, n: number): string[] {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export function monthLabel(month: string, { short = false }: { short?: boolean } = {}): string {
  const name = MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
  return short ? name : `${name} ${month.slice(0, 4)}`;
}

export function sumTotals(receipts: readonly ReceiptData[]): number {
  return receipts.reduce((s, r) => s + receiptTotal(r), 0);
}

export function monthlyTotals(
  receipts: readonly ReceiptData[],
  months: readonly string[],
): { month: string; total: number }[] {
  const byMonth = new Map(months.map((m) => [m, 0]));
  for (const r of receipts) {
    const m = r.date.slice(0, 7);
    if (byMonth.has(m)) byMonth.set(m, byMonth.get(m)! + receiptTotal(r));
  }
  return months.map((month) => ({ month, total: byMonth.get(month)! }));
}

function sorted(map: Map<string, number>): LabelTotal[] {
  return [...map.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function add(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export function totalsByStore(receipts: readonly ReceiptData[]): LabelTotal[] {
  const map = new Map<string, number>();
  for (const r of receipts) add(map, r.store, receiptTotal(r));
  return sorted(map);
}

/**
 * Item line totals per category. Receipts without items count under their receipt category
 * (or Other). Receipt-level discounts/charges go in one net row at the end, so the rows always
 * add up to `sumTotals` (D67).
 */
export function totalsByCategory(receipts: readonly InsightReceipt[]): LabelTotal[] {
  const map = new Map<string, number>();
  let adjustments = 0;
  for (const r of receipts) {
    if (r.items.length === 0) {
      add(map, r.category || FALLBACK_CATEGORY, receiptTotal(r));
      continue;
    }
    for (const it of r.items) add(map, it.category || FALLBACK_CATEGORY, it.lineTotal);
    if (r.kind === 'scanned') {
      const itemsSum = r.items.reduce((s, it) => s + it.lineTotal, 0);
      adjustments += computedTotal(r.items, r.adjustments) - itemsSum;
    } else {
      // A total-only receipt that somehow has items: its printed total is what counts.
      adjustments += r.printedTotal - r.items.reduce((s, it) => s + it.lineTotal, 0);
    }
  }
  const rows = sorted(map);
  if (adjustments !== 0) rows.push({ label: ADJUSTMENTS_LABEL, total: adjustments });
  return rows;
}

/** Totals per card's last 4 digits; `card: null` = no card printed (cash, unknown). */
export function totalsByCard(
  receipts: readonly InsightReceipt[],
): { card: string | null; total: number; count: number }[] {
  const map = new Map<string | null, { total: number; count: number }>();
  for (const r of receipts) {
    const key = r.cardLast4 ?? null;
    const e = map.get(key) ?? { total: 0, count: 0 };
    e.total += receiptTotal(r);
    e.count += 1;
    map.set(key, e);
  }
  return [...map.entries()].map(([card, e]) => ({ card, ...e })).sort((a, b) => b.total - a.total);
}

export interface TopItem {
  key: string;
  /** Name (+ size) as last seen. */
  name: string;
  /** Number of purchases (receipt lines). */
  count: number;
  averagePrice: number;
  unit: ItemUnit;
  totalSpent: number;
}

/** Most-bought products by number of purchases; ties → more money spent first. */
export function topItems(receipts: readonly ReceiptData[], limit = 10): TopItem[] {
  const groups = new Map<
    string,
    { name: string; count: number; priceSum: number; unit: ItemUnit; spent: number; date: string }
  >();
  for (const r of receipts) {
    for (const it of r.items) {
      if (it.lineTotal <= 0 || it.quantity <= 0) continue;
      const key = normalizedKey(it.nameEn, it.sizeLabel);
      const size = it.sizeLabel && !it.nameEn.toLowerCase().endsWith(it.sizeLabel.toLowerCase());
      const name = size ? `${it.nameEn} ${it.sizeLabel}` : it.nameEn;
      const g = groups.get(key);
      const price = effectiveUnitPrice({
        unitPrice: it.unitPrice ?? null,
        lineTotal: it.lineTotal,
        quantity: it.quantity,
      });
      if (!g) {
        groups.set(key, {
          name,
          count: 1,
          priceSum: price,
          unit: it.unit,
          spent: it.lineTotal,
          date: r.date,
        });
      } else {
        g.count += 1;
        g.priceSum += price;
        g.spent += it.lineTotal;
        if (r.date >= g.date) {
          g.name = name;
          g.unit = it.unit;
          g.date = r.date;
        }
      }
    }
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      name: g.name,
      count: g.count,
      averagePrice: Math.round(g.priceSum / g.count),
      unit: g.unit,
      totalSpent: g.spent,
    }))
    .sort((a, b) => b.count - a.count || b.totalSpent - a.totalSpent || a.key.localeCompare(b.key))
    .slice(0, limit);
}
