/**
 * Text search used by the Items tracker. Case- and accent-insensitive, so `banan` finds `BANÁN`
 * and `tej` finds `TEJ`. (SQLite's LIKE/lower() only fold ASCII, so this runs in JS.)
 */
export function foldForSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** True if every word of `query` appears in at least one of `fields`. Empty query matches all. */
export function matchesSearch(
  fields: readonly (string | null | undefined)[],
  query: string,
): boolean {
  const words = foldForSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields
    .filter((f): f is string => !!f)
    .map(foldForSearch)
    .join('\n');
  return words.every((w) => haystack.includes(w));
}
