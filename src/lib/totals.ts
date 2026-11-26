import type { Adjustment, LineItem, ReceiptData } from './types';

/** items − discounts + charges. `points` adjustments are a payment method and are ignored (SPEC §5). */
export function computedTotal(
  items: readonly LineItem[],
  adjustments: readonly Adjustment[],
): number {
  let total = 0;
  for (const item of items) total += item.lineTotal;
  for (const adj of adjustments) {
    if (adj.type === 'discount') total -= adj.amount;
    else if (adj.type === 'charge') total += adj.amount;
  }
  return total;
}

/** Sum of `points` adjustments (e.g. SPAR Repont redeemed). */
export function pointsTotal(adjustments: readonly Adjustment[]): number {
  return adjustments.reduce((sum, a) => (a.type === 'points' ? sum + a.amount : sum), 0);
}

/**
 * The amount a receipt contributes to totals and the Daily Log (DECISIONS D13):
 * `scanned` → computedTotal, `total_only` / `manual` → printedTotal.
 */
export function receiptTotal(receipt: ReceiptData): number {
  return receipt.kind === 'scanned'
    ? computedTotal(receipt.items, receipt.adjustments)
    : receipt.printedTotal;
}

/** Totals per ISO date, keys ascending. */
export function dayTotals(receipts: readonly ReceiptData[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const r of receipts) byDay.set(r.date, (byDay.get(r.date) ?? 0) + receiptTotal(r));
  return new Map([...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export interface SanityCheck {
  computed: number;
  printed: number;
  /** printed − computed. 0 when they agree. */
  diff: number;
  /** True when computed equals printed, or printed + redeemed points (printed total is after points). */
  ok: boolean;
}

/** Compares the computed sum with the printed total for the Review screen banner. */
export function sanityCheck(
  receipt: Pick<ReceiptData, 'items' | 'adjustments' | 'printedTotal'>,
): SanityCheck {
  const computed = computedTotal(receipt.items, receipt.adjustments);
  const printed = receipt.printedTotal;
  const diff = printed - computed;
  const points = pointsTotal(receipt.adjustments);
  const ok = diff === 0 || (points > 0 && printed + points === computed);
  return { computed, printed, diff, ok };
}
