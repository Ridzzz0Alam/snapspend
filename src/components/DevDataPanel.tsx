/**
 * Dev-only Settings section: live receipt count and load / clear the sample data (D42).
 * Rendered only when `__DEV__`, so it never appears in release builds.
 */
import { count } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { Button, usePalette } from '@/components/ui';
import { db } from '@/db/client';
import { notDeleted } from '@/db/repository';
import { receipts } from '@/db/schema';
import { clearSampleData, seedSampleData } from '@/db/seed';

export function DevDataPanel() {
  const c = usePalette();
  const { data } = useLiveQuery(db.select({ n: count() }).from(receipts).where(notDeleted));
  const total = data[0]?.n ?? 0;

  return (
    <View style={[styles.section, { borderColor: c.border, backgroundColor: 'transparent' }]}>
      <Text style={styles.title}>Developer (dev builds only)</Text>
      <Text style={{ color: c.muted }}>Receipts stored: {total}</Text>
      <View style={[styles.row, { backgroundColor: 'transparent' }]}>
        <Button label="Load sample data" kind="secondary" onPress={() => seedSampleData(db)} />
        <Button label="Clear sample data" kind="secondary" onPress={() => clearSampleData(db)} />
      </View>
      <Text style={[styles.hint, { color: c.muted }]}>
        Sample receipts are the SPEC §6 golden-test data, tagged “[sample data]”. Clearing never
        touches real receipts.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  title: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  hint: { fontSize: 12 },
});
