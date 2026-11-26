/**
 * Post-validation normalization of a Gemini receipt (SPEC §5): store aliases, normalizedKey,
 * category coercion and computedTotal.
 */
import { coerceCategory, DEFAULT_CATEGORIES } from './categories';
import type { GeminiLineItem, GeminiReceipt } from './receiptSchema';
import { computedTotal } from './totals';

export interface StoreAlias {
  raw: string;
  canonical: string;
}

export const DEFAULT_STORE_ALIASES: readonly StoreAlias[] = [
  { raw: 'INTERSPAR', canonical: 'SPAR (Interspar)' },
];

const collapse = (s: string): string => s.trim().replace(/\s+/g, ' ');

/**
 * Price-history matching key: English name + size, lowercased, whitespace collapsed.
 * `("UHT milk 2.8%", "1L")` → `"uht milk 2.8% 1l"`. The size isn't repeated if the name already ends with it.
 */
export function normalizedKey(nameEn: string, sizeLabel?: string | null): string {
  const name = collapse(nameEn).toLowerCase();
  const size = sizeLabel ? collapse(sizeLabel).toLowerCase() : '';
  if (!size || name === size || name.endsWith(` ${size}`)) return name;
  return `${name} ${size}`;
}

/** Replaces a raw store name with its canonical alias (case- and whitespace-insensitive). */
export function applyStoreAlias(
  store: string,
  aliases: readonly StoreAlias[] = DEFAULT_STORE_ALIASES,
): string {
  const cleaned = collapse(store);
  const key = cleaned.toLowerCase();
  const hit = aliases.find((a) => collapse(a.raw).toLowerCase() === key);
  return hit ? hit.canonical : cleaned;
}

export interface NormalizedItem extends GeminiLineItem {
  position: number;
  normalizedKey: string;
}

export interface NormalizedReceipt extends Omit<GeminiReceipt, 'items'> {
  items: NormalizedItem[];
  computedTotal: number;
}

export interface NormalizeOptions {
  aliases?: readonly StoreAlias[];
  categories?: readonly string[];
}

export function normalizeReceipt(
  receipt: GeminiReceipt,
  { aliases = DEFAULT_STORE_ALIASES, categories = DEFAULT_CATEGORIES }: NormalizeOptions = {},
): NormalizedReceipt {
  const items = receipt.items.map((item, position) => ({
    ...item,
    position,
    category: coerceCategory(item.category, categories),
    normalizedKey: normalizedKey(item.nameEn, item.sizeLabel),
  }));
  return {
    ...receipt,
    store: applyStoreAlias(receipt.store, aliases),
    items,
    computedTotal: computedTotal(items, receipt.adjustments),
  };
}
