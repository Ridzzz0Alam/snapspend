import { coerceCategory } from '@/lib/categories';
import { applyStoreAlias, normalizedKey, normalizeReceipt } from '@/lib/normalize';
import { validateReceipt } from '@/lib/receiptSchema';

import { validScanned } from './fixtures/gemini';

describe('normalizedKey', () => {
  it.each<[string, string | null, string]>([
    ['UHT milk 2.8%', '1L', 'uht milk 2.8% 1l'],
    ['  UHT   milk 2.8% ', ' 1L ', 'uht milk 2.8% 1l'],
    ['Banana', null, 'banana'],
    ['Chocolate donut', '', 'chocolate donut'],
    ['Toast bread 500g', '500g', 'toast bread 500g'],
    ['Milka Alpine milk chocolate', '90g', 'milka alpine milk chocolate 90g'],
  ])('(%p, %p) → %p', (name, size, expected) => {
    expect(normalizedKey(name, size)).toBe(expected);
  });

  it('treats different sizes as different products', () => {
    expect(normalizedKey('Sauce beans', '420g')).not.toBe(normalizedKey('Sauce beans', '200g'));
  });
});

describe('applyStoreAlias', () => {
  it('maps INTERSPAR to SPAR (Interspar) by default, ignoring case and spacing', () => {
    expect(applyStoreAlias('INTERSPAR')).toBe('SPAR (Interspar)');
    expect(applyStoreAlias(' interspar ')).toBe('SPAR (Interspar)');
  });

  it('leaves unknown stores alone (trimmed)', () => {
    expect(applyStoreAlias('  ALDI  ')).toBe('ALDI');
  });

  it('uses custom aliases', () => {
    const aliases = [{ raw: 'TESCO GLOBAL ZRT', canonical: 'TESCO' }];
    expect(applyStoreAlias('Tesco  Global Zrt', aliases)).toBe('TESCO');
    expect(applyStoreAlias('INTERSPAR', aliases)).toBe('INTERSPAR');
  });
});

describe('coerceCategory', () => {
  it('matches case-insensitively and falls back to Other', () => {
    expect(coerceCategory('dairy & eggs')).toBe('Dairy & Eggs');
    expect(coerceCategory('Groceries')).toBe('Other');
    expect(coerceCategory('Toys', ['Food', 'Misc'])).toBe('Misc');
  });
});

describe('normalizeReceipt', () => {
  it('applies alias, keys, positions, categories and computedTotal', () => {
    const parsed = validateReceipt({
      ...validScanned,
      items: [...validScanned.items, { ...validScanned.items[0]!, category: 'Milk stuff' }],
    });
    if (!parsed.ok) throw new Error(parsed.issues.join('\n'));

    const n = normalizeReceipt(parsed.data);
    expect(n.store).toBe('SPAR (Interspar)');
    expect(n.items.map((i) => [i.position, i.normalizedKey, i.category])).toEqual([
      [0, 'uht milk 2.8% 1l', 'Dairy & Eggs'],
      [1, 'banana', 'Fruit & Veg'],
      [2, 'bio bag', 'Household & Cleaning'],
      [3, 'uht milk 2.8% 1l', 'Other'],
    ]);
    // 570 + 581 + 19 + 570; the Repont points adjustment does not reduce it.
    expect(n.computedTotal).toBe(1740);
  });
});
