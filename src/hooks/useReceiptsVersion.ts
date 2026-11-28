/**
 * A value that changes whenever receipts are saved, edited or deleted (live query on the receipt
 * count and the latest `updatedAt`). Screens put it in their `useMemo` deps to refresh themselves.
 */
import { count, max } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { notDeleted } from '@/db/repository';
import { receipts } from '@/db/schema';

export function useReceiptsVersion(): string {
  const { data } = useLiveQuery(
    db
      .select({ n: count(), changed: max(receipts.updatedAt) })
      .from(receipts)
      .where(notDeleted),
  );
  return `${data[0]?.n ?? 0}|${data[0]?.changed ?? 0}`;
}
