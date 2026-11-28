/** Excel export (D71): an Items sheet and a Receipts sheet, oldest first. Pure. */
import { effectiveUnitPrice } from './priceHistory';
import { receiptTotal } from './totals';
import type { AdjustmentType, ItemUnit, ReceiptKind } from './types';
import type { SheetSpec } from './xlsx';

export interface ExportReceipt {
  kind: ReceiptKind;
  store: string;
  date: string;
  time: string | null;
  printedTotal: number;
  cardLast4: string | null;
  category: string | null;
  note: string | null;
  items: {
    nameEn: string;
    nameOriginal: string | null;
    sizeLabel: string | null;
    quantity: number;
    unit: ItemUnit;
    unitPrice: number | null;
    lineTotal: number;
    category: string;
  }[];
  adjustments: { type: AdjustmentType; label: string; amount: number }[];
}

const KIND_LABEL: Record<ReceiptKind, string> = {
  scanned: 'Scanned',
  total_only: 'Total only',
  manual: 'Manual',
};

const chronological = (a: ExportReceipt, b: ExportReceipt) =>
  a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99');

function sumOf(r: ExportReceipt, type: AdjustmentType): number | null {
  const list = r.adjustments.filter((a) => a.type === type);
  return list.length ? list.reduce((s, a) => s + a.amount, 0) : null;
}

export function buildExportSheets(receipts: readonly ExportReceipt[]): SheetSpec[] {
  const sorted = [...receipts].sort(chronological);
  return [
    {
      name: 'Items',
      columns: [
        { header: 'Date', format: 'date', width: 11 },
        { header: 'Time', width: 6 },
        { header: 'Store', width: 18 },
        { header: 'Item', width: 30 },
        { header: 'Original name', width: 28 },
        { header: 'Size', width: 8 },
        { header: 'Qty', format: 'qty', width: 7 },
        { header: 'Unit', width: 5 },
        { header: 'Unit price (Ft)', format: 'money', width: 13 },
        { header: 'Total (Ft)', format: 'money', width: 11 },
        { header: 'Category', width: 20 },
        { header: 'Card', width: 6 },
      ],
      rows: sorted.flatMap((r) =>
        r.items.map((it) => [
          { date: r.date },
          r.time,
          r.store,
          it.nameEn,
          it.nameOriginal,
          it.sizeLabel,
          it.quantity,
          it.unit,
          it.quantity > 0 ? effectiveUnitPrice(it) : it.unitPrice,
          it.lineTotal,
          it.category,
          r.cardLast4,
        ]),
      ),
    },
    {
      name: 'Receipts',
      columns: [
        { header: 'Date', format: 'date', width: 11 },
        { header: 'Time', width: 6 },
        { header: 'Store', width: 18 },
        { header: 'Type', width: 10 },
        { header: 'Total (Ft)', format: 'money', width: 11 },
        { header: 'Printed total (Ft)', format: 'money', width: 15 },
        { header: 'Items', width: 6 },
        { header: 'Discounts (Ft)', format: 'money', width: 13 },
        { header: 'Charges (Ft)', format: 'money', width: 12 },
        { header: 'Points (Ft)', format: 'money', width: 11 },
        { header: 'Card', width: 6 },
        { header: 'Category', width: 18 },
        { header: 'Note', width: 24 },
      ],
      rows: sorted.map((r) => [
        { date: r.date },
        r.time,
        r.store,
        KIND_LABEL[r.kind],
        receiptTotal(r),
        r.printedTotal,
        r.items.length,
        sumOf(r, 'discount'),
        sumOf(r, 'charge'),
        sumOf(r, 'points'),
        r.cardLast4,
        r.category,
        r.note,
      ]),
    },
  ];
}

export function exportFileName(todayIso: string, kind: 'xlsx' | 'json'): string {
  return kind === 'xlsx' ? `snapspend-${todayIso}.xlsx` : `snapspend-backup-${todayIso}.json`;
}
