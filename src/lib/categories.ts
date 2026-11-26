/** Default categories (SPEC §3). The user can edit the list in Settings (Phase 8). */
export const DEFAULT_CATEGORIES = [
  'Dairy & Eggs',
  'Bakery',
  'Fruit & Veg',
  'Meat & Fish',
  'Pantry',
  'Snacks & Sweets',
  'Drinks & Coffee',
  'Frozen',
  'Household & Cleaning',
  'Personal care',
  'Eating out',
  'Phone & Top-ups',
  'Other',
] as const;

export const FALLBACK_CATEGORY = 'Other';

/**
 * Maps a category string onto the given list, ignoring case and surrounding whitespace.
 * Unknown categories become `Other` (or the list's last entry if it has no `Other`).
 */
export function coerceCategory(
  category: string,
  categories: readonly string[] = DEFAULT_CATEGORIES,
): string {
  const wanted = category.trim().toLowerCase();
  const match = categories.find((c) => c.toLowerCase() === wanted);
  if (match) return match;
  if (categories.includes(FALLBACK_CATEGORY)) return FALLBACK_CATEGORY;
  return categories[categories.length - 1] ?? FALLBACK_CATEGORY;
}
