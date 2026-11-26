/**
 * Daily Log text format. SPEC §6 is the contract; golden tests in __tests__/format.test.ts.
 */
import { formatAmount } from './money';
import { receiptTotal } from './totals';
import type { Adjustment, LineItem, ReceiptData } from './types';

const TIMES = '×'; // ×
const MINUS = '−'; // −

export interface DailyLogOptions {
  /** Append a blank line and `GRAND TOTAL - {sum} Ft`. */
  grandTotal: boolean;
}

/** ISO `YYYY-MM-DD` → `DD/MM/YYYY`. */
export function formatLogDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Unit price to print; falls back to lineTotal / quantity when missing (DECISIONS D16). */
function unitPriceOf(item: LineItem): number {
  if (item.unitPrice != null) return item.unitPrice;
  return item.quantity === 0 ? 0 : Math.round(item.lineTotal / item.quantity);
}

export function formatItemToken(item: LineItem): string {
  const name = item.sizeLabel ? `${item.nameEn} ${item.sizeLabel}` : item.nameEn;
  const total = `${formatAmount(item.lineTotal)}Ft`;

  if (item.unit === 'kg') {
    const qty = item.quantity.toFixed(3);
    return `${name} ${qty}Kg${TIMES}${formatAmount(unitPriceOf(item))}Ft/Kg ${total}`;
  }
  if (item.quantity === 1) return `${name} ${total}`;
  return `${name} ${item.quantity}Db${TIMES}${formatAmount(unitPriceOf(item))}Ft/Db ${total}`;
}

/** Adjustment suffix including its leading separator, or '' for `points` (DECISIONS D14). */
function formatAdjustment(adj: Adjustment): string {
  if (adj.type === 'discount') return ` ${MINUS} ${adj.label} ${formatAmount(adj.amount)}Ft`;
  if (adj.type === 'charge') return ` + ${adj.label} ${formatAmount(adj.amount)}Ft`;
  return '';
}

export function formatReceiptLine(receipt: ReceiptData): string {
  const total = `${formatAmount(receiptTotal(receipt))} Ft`;
  if (receipt.kind !== 'scanned') return `${receipt.store} => ${total}`;

  const items = receipt.items.map(formatItemToken).join(' + ');
  const adjustments = receipt.adjustments.map(formatAdjustment).join('');
  return `${receipt.store} => ${items}${adjustments} = ${total}`;
}

/** Within a day: time ascending, untimed last, then createdAt (DECISIONS D15). */
function compareInDay(a: ReceiptData, b: ReceiptData): number {
  const ta = a.time ?? null;
  const tb = b.time ?? null;
  if (ta !== tb) {
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta < tb ? -1 : 1;
  }
  return (a.createdAt ?? 0) - (b.createdAt ?? 0);
}

/**
 * Renders the Daily Log for the given receipts (any order). Lines are joined with `\n`;
 * there is no trailing newline. Returns '' when there are no receipts.
 */
export function formatDailyLog(receipts: readonly ReceiptData[], options: DailyLogOptions): string {
  const byDay = new Map<string, ReceiptData[]>();
  for (const r of receipts) {
    const list = byDay.get(r.date);
    if (list) list.push(r);
    else byDay.set(r.date, [r]);
  }
  const days = [...byDay.keys()].sort();

  let grand = 0;
  const blocks = days.map((day) => {
    const dayReceipts = [...(byDay.get(day) ?? [])].sort(compareInDay);
    let dayTotal = 0;
    const lines = [formatLogDate(day)];
    for (const r of dayReceipts) {
      lines.push(formatReceiptLine(r));
      dayTotal += receiptTotal(r);
    }
    lines.push(`TOTAL - ${formatAmount(dayTotal)} Ft`);
    grand += dayTotal;
    return lines.join('\n');
  });

  if (blocks.length === 0) return '';
  if (options.grandTotal) blocks.push(`GRAND TOTAL - ${formatAmount(grand)} Ft`);
  return blocks.join('\n\n');
}
