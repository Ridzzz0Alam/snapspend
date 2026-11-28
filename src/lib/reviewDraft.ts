/**
 * The editable form behind the Review screen and the manual "Add expense" form (SPEC §2.2–2.3).
 * Numbers are kept as the text the user typed; `validateDraft` turns the form into a
 * repository `ReceiptInput` or a map of field errors. Never throws.
 */
import { coerceCategory, DEFAULT_CATEGORIES, FALLBACK_CATEGORY } from './categories';
import { parseDisplayDate, parseTime } from './dates';
import { formatLogDate } from './format';
import { parseHuf } from './money';
import {
  applyStoreAlias,
  DEFAULT_STORE_ALIASES,
  type NormalizedReceipt,
  type StoreAlias,
} from './normalize';
import { sanityCheck, type SanityCheck } from './totals';
import type { Adjustment, AdjustmentType, ItemUnit, LineItem, ReceiptKind } from './types';

export interface ItemDraft {
  key: string;
  nameEn: string;
  nameOriginal: string;
  sizeLabel: string;
  quantity: string;
  unit: ItemUnit;
  unitPrice: string;
  lineTotal: string;
  category: string;
}

export interface AdjustmentDraft {
  key: string;
  type: AdjustmentType;
  label: string;
  amount: string;
  appliesTo: string | null;
}

export interface ReceiptDraft {
  kind: ReceiptKind;
  store: string;
  /** DD/MM/YYYY as shown on screen. */
  date: string;
  time: string;
  cardLast4: string;
  paymentMethod: string | null;
  printedTotal: string;
  note: string;
  /** Receipt-level category for manual / total-only entries ('' = none, D55). */
  category: string;
  items: ItemDraft[];
  adjustments: AdjustmentDraft[];
  rawGeminiJson: string | null;
}

/** Same shape as the repository's ReceiptInput (kept here so src/lib doesn't import src/db). */
export interface DraftInput {
  kind: ReceiptKind;
  store: string;
  date: string;
  time: string | null;
  printedTotal: number;
  cardLast4: string | null;
  paymentMethod: string | null;
  rawGeminiJson: string | null;
  note: string | null;
  category: string | null;
  items: Required<LineItem>[];
  adjustments: Adjustment[];
}

export type DraftErrors = Record<string, string>;

const text = (v: number | null | undefined) => (v == null ? '' : String(v));

export function blankItem(newKey: () => string, category: string = FALLBACK_CATEGORY): ItemDraft {
  return {
    key: newKey(),
    nameEn: '',
    nameOriginal: '',
    sizeLabel: '',
    quantity: '1',
    unit: 'pcs',
    unitPrice: '',
    lineTotal: '',
    category,
  };
}

export function blankAdjustment(newKey: () => string): AdjustmentDraft {
  return { key: newKey(), type: 'discount', label: '', amount: '', appliesTo: null };
}

export function draftFromExtracted(
  r: NormalizedReceipt,
  rawJson: string | null,
  newKey: () => string,
): ReceiptDraft {
  return {
    kind: r.kind,
    store: r.store,
    date: formatLogDate(r.date),
    time: r.time ?? '',
    cardLast4: r.cardLast4 ?? '',
    paymentMethod: r.paymentMethod,
    printedTotal: text(r.printedTotal),
    note: '',
    category: '',
    items: r.items.map((it) => ({
      key: newKey(),
      nameEn: it.nameEn,
      nameOriginal: it.nameOriginal ?? '',
      sizeLabel: it.sizeLabel ?? '',
      quantity: text(it.quantity),
      unit: it.unit,
      unitPrice: text(it.unitPrice),
      lineTotal: text(it.lineTotal),
      category: it.category,
    })),
    adjustments: r.adjustments.map((a) => ({
      key: newKey(),
      type: a.type,
      label: a.label,
      amount: text(a.amount),
      appliesTo: a.appliesTo,
    })),
    rawGeminiJson: rawJson,
  };
}

/** A blank form: manual expense, or a scanned receipt typed in by hand. */
export function emptyDraft(kind: ReceiptKind, todayIso: string): ReceiptDraft {
  return {
    kind,
    store: '',
    date: formatLogDate(todayIso),
    time: '',
    cardLast4: '',
    paymentMethod: null,
    printedTotal: '',
    note: '',
    category: '',
    items: [],
    adjustments: [],
    rawGeminiJson: null,
  };
}

/** `0,792` / `0.792` / `2` → number > 0, else null. */
export function parseQuantity(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

const moneyOrZero = (s: string) => parseHuf(s) ?? 0;

/** Live sanity check for the banner; half-typed numbers count as 0. */
export function draftTotals(d: ReceiptDraft): SanityCheck {
  return sanityCheck({
    printedTotal: moneyOrZero(d.printedTotal),
    items: d.items.map((it) => ({
      nameEn: it.nameEn,
      quantity: parseQuantity(it.quantity) ?? 0,
      unit: it.unit,
      lineTotal: moneyOrZero(it.lineTotal),
    })),
    adjustments: d.adjustments.map((a) => ({
      type: a.type,
      label: a.label,
      amount: Math.abs(moneyOrZero(a.amount)),
    })),
  });
}

export function validateDraft(
  d: ReceiptDraft,
  {
    aliases = DEFAULT_STORE_ALIASES,
    categories = DEFAULT_CATEGORIES,
  }: { aliases?: readonly StoreAlias[]; categories?: readonly string[] } = {},
): { ok: true; input: DraftInput } | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {};

  const store = d.store.trim() ? applyStoreAlias(d.store, aliases) : '';
  if (!store) errors.store = 'Enter the store or a label';

  const date = parseDisplayDate(d.date);
  if (!date) errors.date = 'Use DD/MM/YYYY';

  const time = parseTime(d.time);
  if (!time.ok) errors.time = 'Use HH:MM or leave empty';

  const card = d.cardLast4.trim();
  if (card && !/^\d{4}$/.test(card)) errors.cardLast4 = '4 digits or empty';

  const printedTotal = parseHuf(d.printedTotal);
  if (printedTotal == null || printedTotal < 0) errors.printedTotal = 'Enter the total in Ft';

  const items: Required<LineItem>[] = [];
  for (const it of d.items) {
    const at = (f: string) => `items.${it.key}.${f}`;
    const nameEn = it.nameEn.trim();
    if (!nameEn) errors[at('nameEn')] = 'Name needed';
    const quantity = parseQuantity(it.quantity);
    if (quantity == null) errors[at('quantity')] = 'More than 0';
    const lineTotal = parseHuf(it.lineTotal);
    if (lineTotal == null) errors[at('lineTotal')] = 'Amount in Ft';
    let unitPrice: number | null = null;
    if (it.unitPrice.trim()) {
      unitPrice = parseHuf(it.unitPrice);
      if (unitPrice == null || unitPrice < 0) errors[at('unitPrice')] = 'Price in Ft or empty';
    }
    items.push({
      nameEn,
      nameOriginal: it.nameOriginal.trim() || null,
      sizeLabel: it.sizeLabel.trim() || null,
      quantity: quantity ?? 0,
      unit: it.unit,
      unitPrice,
      lineTotal: lineTotal ?? 0,
      category: coerceCategory(it.category, categories),
    });
  }

  const adjustments: Adjustment[] = [];
  for (const a of d.adjustments) {
    const at = (f: string) => `adjustments.${a.key}.${f}`;
    const label = a.label.trim();
    if (!label) errors[at('label')] = 'Label needed';
    const amount = parseHuf(a.amount);
    if (amount == null || amount < 0) errors[at('amount')] = 'Positive amount in Ft';
    adjustments.push({ type: a.type, label, amount: amount ?? 0, appliesTo: a.appliesTo });
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  // A scanned receipt whose items were all removed is just a total (SPEC §2.3 total_only).
  const kind: ReceiptKind = d.kind === 'scanned' && items.length === 0 ? 'total_only' : d.kind;

  return {
    ok: true,
    input: {
      kind,
      store,
      date: date!,
      time: time.ok ? time.value : null,
      printedTotal: printedTotal!,
      cardLast4: card || null,
      paymentMethod: d.paymentMethod,
      rawGeminiJson: d.rawGeminiJson,
      note: d.note.trim() || null,
      category: d.category.trim() ? coerceCategory(d.category, categories) : null,
      items,
      adjustments,
    },
  };
}
