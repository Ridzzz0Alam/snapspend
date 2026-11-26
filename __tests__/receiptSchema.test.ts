import { validateReceipt } from '@/lib/receiptSchema';

import { validScanned, validTotalOnly } from './fixtures/gemini';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('validateReceipt — valid', () => {
  it('accepts a full scanned receipt and fills defaults', () => {
    const r = validateReceipt(validScanned);
    if (!r.ok) throw new Error(r.issues.join('\n'));
    expect(r.data.store).toBe('INTERSPAR');
    expect(r.data.cardLast4).toBe('4821');
    expect(r.data.items).toHaveLength(3);
    expect(r.data.items[2]).toEqual({
      nameEn: 'Bio bag',
      nameOriginal: null,
      sizeLabel: null,
      quantity: 1,
      unit: 'pcs',
      unitPrice: null,
      lineTotal: 19,
      category: 'Household & Cleaning',
    });
  });

  it('accepts a total-only slip with optional fields missing', () => {
    const r = validateReceipt(validTotalOnly);
    if (!r.ok) throw new Error(r.issues.join('\n'));
    expect(r.data).toMatchObject({
      kind: 'total_only',
      time: null,
      cardLast4: null,
      paymentMethod: null,
      confidence: null,
      notes: [],
    });
  });

  it('accepts the raw JSON string', () => {
    expect(validateReceipt(JSON.stringify(validTotalOnly)).ok).toBe(true);
  });

  it('drops seconds from time and nulls an unusable card number', () => {
    const input = { ...clone(validTotalOnly), time: '09:05:33', cardLast4: 'XX' };
    const r = validateReceipt(input);
    if (!r.ok) throw new Error(r.issues.join('\n'));
    expect(r.data.time).toBe('09:05');
    expect(r.data.cardLast4).toBeNull();
  });
});

describe('validateReceipt — invalid', () => {
  const mutate = (fn: (r: Record<string, unknown> & typeof validScanned) => void) => {
    const r = clone(validScanned) as Record<string, unknown> & typeof validScanned;
    fn(r);
    return r;
  };

  it.each<[string, unknown, string]>([
    ['missing store', mutate((r) => delete (r as Partial<typeof r>).store), 'store'],
    ['empty store', mutate((r) => (r.store = '  ')), 'store'],
    ['bad kind', mutate((r) => (r.kind = 'manual')), 'kind'],
    ['date in DD/MM/YYYY', mutate((r) => (r.date = '02/11/2026')), 'date'],
    ['impossible date', mutate((r) => (r.date = '2026-02-30')), 'date'],
    ['bad time', mutate((r) => (r.time = '25:00')), 'time'],
    ['float line total', mutate((r) => (r.items[0]!.lineTotal = 570.5)), 'items.0.lineTotal'],
    ['amount as string', mutate((r) => (r.printedTotal = '1070' as never)), 'printedTotal'],
    ['unknown unit', mutate((r) => (r.items[1]!.unit = 'g')), 'items.1.unit'],
    ['zero quantity', mutate((r) => (r.items[0]!.quantity = 0)), 'items.0.quantity'],
    [
      'negative adjustment',
      mutate((r) => (r.adjustments[0]!.amount = -100)),
      'adjustments.0.amount',
    ],
    [
      'bad adjustment type',
      mutate((r) => (r.adjustments[0]!.type = 'refund')),
      'adjustments.0.type',
    ],
    ['items not an array', mutate((r) => (r.items = null as never)), 'items'],
    ['confidence > 1', mutate((r) => (r.confidence = 1.5)), 'confidence'],
  ])('%s', (_name, input, path) => {
    const r = validateReceipt(input);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.some((i) => i.startsWith(`${path}:`))).toBe(true);
  });

  it.each([null, 42, 'not json {', '[]'])('rejects %p without throwing', (input) => {
    const r = validateReceipt(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toEqual(expect.any(String));
  });
});
