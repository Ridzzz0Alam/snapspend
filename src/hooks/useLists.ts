/**
 * Live category list and store aliases from the database (D73). Screens and the receipt form use
 * these instead of the built-in defaults, so edits in Settings show up everywhere straight away.
 */
import { asc, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { categories, storeAliases } from '@/db/schema';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import type { StoreAlias } from '@/lib/normalize';

export function useCategories(): readonly string[] {
  const { data } = useLiveQuery(
    db.select({ name: categories.name }).from(categories).orderBy(asc(categories.position)),
  );
  return useMemo(
    // Before the first query returns, fall back to the defaults rather than an empty list.
    () => (data.length ? data.map((r) => r.name) : DEFAULT_CATEGORIES),
    [data],
  );
}

export function useStoreAliases(): readonly StoreAlias[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(storeAliases)
      .orderBy(sql`${storeAliases.raw} COLLATE NOCASE`),
  );
  return data;
}

/** Both lists, in the shape validateDraft / normalizeReceipt take. */
export function useNormalizeOptions() {
  const cats = useCategories();
  const aliases = useStoreAliases();
  return useMemo(() => ({ categories: cats, aliases }), [cats, aliases]);
}
