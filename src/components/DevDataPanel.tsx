/**
 * Dev-only Settings page content: live receipt count and load / clear the sample data (D42).
 * Reachable only when `__DEV__`, so it never appears in release builds.
 */
import { count } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { notDeleted } from '@/db/repository';
import { receipts } from '@/db/schema';
import { clearSampleData, seedSampleData } from '@/db/seed';

import { SettingsGroup, SettingsRow } from './SettingsList';

export function DevDataPanel() {
  const { data } = useLiveQuery(db.select({ n: count() }).from(receipts).where(notDeleted));
  const total = data[0]?.n ?? 0;

  return (
    <SettingsGroup
      title="Sample data"
      footer="Sample receipts are the SPEC §6 golden-test data, tagged “[sample data]”. Clearing never touches real receipts."
    >
      <SettingsRow
        icon="receipt_long"
        title={`${total} receipts stored`}
        subtitle="Live, not deleted"
      />
      <SettingsRow
        icon="science"
        title="Load sample data"
        chevron={false}
        onPress={() => seedSampleData(db)}
      />
      <SettingsRow
        icon="delete_sweep"
        title="Clear sample data"
        danger
        chevron={false}
        onPress={() => clearSampleData(db)}
      />
    </SettingsGroup>
  );
}
