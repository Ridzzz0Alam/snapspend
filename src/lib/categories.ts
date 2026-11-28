/**
 * Default categories (SPEC §3). The live list is in the `categories` table, edited in Settings (D73);
 * these seed it and are the fallback in pure code and tests.
 */
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

export const MAX_CATEGORY_LENGTH = 40;

/** Trims and collapses inner whitespace, as category and store names are stored. */
export const cleanName = (s: string): string => s.trim().replace(/\s+/g, ' ');

/**
 * Checks a new or renamed category name against the list (case-insensitive).
 * `current` is the category being renamed, so keeping or re-casing its own name is allowed.
 * Returns an error message, or null when the name is fine.
 */
export function checkCategoryName(
  name: string,
  existing: readonly string[],
  current?: string,
): string | null {
  const cleaned = cleanName(name);
  if (!cleaned) return 'Enter a name';
  if (cleaned.length > MAX_CATEGORY_LENGTH) return `At most ${MAX_CATEGORY_LENGTH} characters`;
  const key = cleaned.toLowerCase();
  const clash = existing.find((c) => c.toLowerCase() === key && c !== current);
  return clash ? `"${clash}" already exists` : null;
}
