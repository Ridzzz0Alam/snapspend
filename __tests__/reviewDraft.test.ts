import { normalizeReceipt } from '@/lib/normalize';
import { validateReceipt } from '@/lib/receiptSchema';
import {
  blankAdjustment,
  blankItem,
  draftFromExtracted,
  draftFromStored,
  draftTotals,
  emptyDraft,
  parseQuantity,
  validateDraft,
  type ReceiptDraft,
} from '@/lib/reviewDraft';

import { validScanned } from './fixtures/gemini';

let n = 0;
const key = () => `k${++n}`;
beforeEach(() => {
  n = 0;
});

function scannedDraft(): ReceiptDraft {
  const v = validateReceipt(validScanned);
  if (!v.ok) throw new Error('fixture invalid');
  return draftFromExtracted(normalizeReceipt(v.data), '{"raw":true}', key);
}

describe('parseQuantity', () => {
  it('accepts dot or comma decimals', () => {
    expect(parseQuantity('0,792')).toBe(0.792);
    expect(parseQuantity(' 2 ')).toBe(2);
    expect(parseQuantity('1.5')).toBe(1.5);
  });
  it('rejects zero, negatives and junk', () => {
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('-1')).toBeNull();
    expect(parseQuantity('two')).toBeNull();
    expect(parseQuantity('')).toBeNull();
  });
});

describe('draftFromExtracted', () => {
  it('turns a Gemini receipt into editable text fields', () => {
    const d = scannedDraft();
    expect(d).toMatchObject({
      kind: 'scanned',
      store: 'SPAR (Interspar)', // alias applied
      date: '02/11/2026',
      time: '17:40',
      cardLast4: '4821',
      printedTotal: '1070',
      rawGeminiJson: '{"raw":true}',
    });
    expect(d.items[1]).toMatchObject({
      key: 'k2',
      nameEn: 'Banana',
      quantity: '1.294',
      unit: 'kg',
      unitPrice: '449',
      lineTotal: '581',
      category: 'Fruit & Veg',
    });
    expect(d.items[2]).toMatchObject({ unitPrice: '', nameOriginal: '', sizeLabel: '' });
    expect(d.adjustments).toEqual([
      { key: 'k4', type: 'points', label: 'Repont', amount: '100', appliesTo: null },
    ]);
  });
});

describe('draftTotals', () => {
  it('runs the sanity check on the current values', () => {
    const d = scannedDraft();
    // 570 + 581 + 19 = 1170 computed; printed 1070 + 100 Repont points = 1170 → ok (D26)
    expect(draftTotals(d)).toMatchObject({ computed: 1170, printed: 1070, ok: true });
  });

  it('treats fields that are still being typed as 0 instead of failing', () => {
    const d = scannedDraft();
    d.items[0]!.lineTotal = '';
    d.printedTotal = 'abc';
    expect(draftTotals(d)).toMatchObject({ computed: 600, printed: 0, ok: false, diff: -600 });
  });
});

describe('validateDraft', () => {
  it('produces a ReceiptInput for the repository', () => {
    const d = scannedDraft();
    d.note = '  weekly shop ';
    const r = validateDraft(d);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.input).toMatchObject({
      kind: 'scanned',
      store: 'SPAR (Interspar)',
      date: '2026-11-02',
      time: '17:40',
      printedTotal: 1070,
      cardLast4: '4821',
      paymentMethod: 'card',
      rawGeminiJson: '{"raw":true}',
      note: 'weekly shop',
      category: null,
    });
    expect(r.input.items[1]).toEqual({
      nameEn: 'Banana',
      nameOriginal: 'BANÁN',
      sizeLabel: null,
      quantity: 1.294,
      unit: 'kg',
      unitPrice: 449,
      lineTotal: 581,
      category: 'Fruit & Veg',
    });
    expect(r.input.adjustments).toEqual([
      { type: 'points', label: 'Repont', amount: 100, appliesTo: null },
    ]);
  });

  it('reads Hungarian-style money and comma quantities', () => {
    const d = scannedDraft();
    d.printedTotal = '1.070 Ft';
    d.items[1]!.quantity = '1,294';
    const r = validateDraft(d);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.input.printedTotal).toBe(1070);
    expect(r.input.items[1]!.quantity).toBe(1.294);
  });

  it('applies store aliases to a typed store name', () => {
    const d = scannedDraft();
    d.store = '  interspar ';
    const r = validateDraft(d);
    expect(r.ok && r.input.store).toBe('SPAR (Interspar)');
  });

  it('reports every bad field by key', () => {
    const d = scannedDraft();
    d.store = ' ';
    d.date = '31/02/2026';
    d.time = '25:00';
    d.cardLast4 = '12';
    d.printedTotal = '';
    d.items[0]!.nameEn = '';
    d.items[0]!.quantity = '0';
    d.items[1]!.lineTotal = 'x';
    d.items[1]!.unitPrice = 'y';
    d.adjustments[0]!.amount = '-5';
    d.adjustments[0]!.label = '';
    const r = validateDraft(d);
    if (r.ok) throw new Error('expected errors');
    expect(Object.keys(r.errors).sort()).toEqual(
      [
        'store',
        'date',
        'time',
        'cardLast4',
        'printedTotal',
        'items.k1.nameEn',
        'items.k1.quantity',
        'items.k2.lineTotal',
        'items.k2.unitPrice',
        'adjustments.k4.amount',
        'adjustments.k4.label',
      ].sort(),
    );
  });

  it('a negative line total is allowed (returned item)', () => {
    const d = scannedDraft();
    d.items[0]!.lineTotal = '-570';
    expect(validateDraft(d).ok).toBe(true);
  });

  it('a scanned receipt whose items were all deleted is saved as total_only', () => {
    const d = scannedDraft();
    d.items = [];
    const r = validateDraft(d);
    expect(r.ok && r.input.kind).toBe('total_only');
  });

  it('maps an unknown category to Other', () => {
    const d = scannedDraft();
    d.items[0]!.category = 'Gadgets';
    const r = validateDraft(d);
    expect(r.ok && r.input.items[0]!.category).toBe('Other');
  });
});

describe('emptyDraft / blank rows', () => {
  it('starts a manual expense dated today with no items', () => {
    const d = emptyDraft('manual', '2026-11-28');
    expect(d).toMatchObject({
      kind: 'manual',
      store: '',
      date: '28/11/2026',
      printedTotal: '',
      items: [],
      adjustments: [],
      rawGeminiJson: null,
    });
    d.store = 'Yettel Recharge';
    d.printedTotal = '5000';
    const r = validateDraft(d);
    expect(r.ok && r.input).toMatchObject({ kind: 'manual', printedTotal: 5000, items: [] });
  });

  it('keeps an optional receipt-level category (manual expenses, D55)', () => {
    const d = emptyDraft('manual', '2026-11-28');
    d.store = 'University Coffee Machine';
    d.printedTotal = '350';
    expect(
      validateDraft(d).ok && (validateDraft(d) as { input: { category: unknown } }).input.category,
    ).toBeNull();
    d.category = 'eating out';
    const r = validateDraft(d);
    expect(r.ok && r.input.category).toBe('Eating out');
  });

  it('blank rows have unique keys and sensible defaults', () => {
    expect(blankItem(key)).toMatchObject({
      key: 'k1',
      quantity: '1',
      unit: 'pcs',
      category: 'Other',
    });
    expect(blankAdjustment(key)).toMatchObject({ key: 'k2', type: 'discount', amount: '' });
  });
});

describe('draftFromStored (Receipt detail edit)', () => {
  it('round-trips a saved receipt through the form unchanged', () => {
    const stored = {
      kind: 'scanned' as const,
      store: 'TESCO',
      date: '2026-11-07',
      time: '18:05',
      printedTotal: 1366,
      cardLast4: '4821',
      paymentMethod: 'card',
      rawGeminiJson: '{}',
      note: 'n',
      category: null,
      items: [
        {
          nameEn: 'Dates',
          nameOriginal: 'DATOLYA',
          sizeLabel: '200g',
          quantity: 1,
          unit: 'pcs' as const,
          unitPrice: null,
          lineTotal: 449,
          category: 'Snacks & Sweets',
        },
      ],
      adjustments: [{ type: 'discount' as const, label: 'Clubcard', amount: 100, appliesTo: null }],
    };
    const d = draftFromStored(stored, key);
    expect(d).toMatchObject({ date: '07/11/2026', time: '18:05', printedTotal: '1366', note: 'n' });
    const r = validateDraft(d);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const { items, adjustments, ...rest } = r.input;
    expect(rest).toEqual({
      kind: 'scanned',
      store: 'TESCO',
      date: '2026-11-07',
      time: '18:05',
      printedTotal: 1366,
      cardLast4: '4821',
      paymentMethod: 'card',
      rawGeminiJson: '{}',
      note: 'n',
      category: null,
    });
    expect(items).toEqual(stored.items);
    expect(adjustments).toEqual(stored.adjustments);
  });

  it('keeps the receipt category of a manual entry', () => {
    const d = draftFromStored(
      {
        kind: 'manual',
        store: 'Yettel Recharge',
        date: '2026-11-13',
        time: null,
        printedTotal: 3000,
        cardLast4: null,
        paymentMethod: null,
        rawGeminiJson: null,
        note: null,
        category: 'Phone & Top-ups',
        items: [],
        adjustments: [],
      },
      key,
    );
    expect(d).toMatchObject({ kind: 'manual', category: 'Phone & Top-ups', time: '', note: '' });
  });
});
