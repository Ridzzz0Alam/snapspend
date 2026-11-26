/**
 * Dev-only panel for checking the database on a device: live receipt count, load/clear the
 * sample data, and the Daily Log rendered from what's actually stored. Not shown in release builds.
 */
import { count } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { db } from '@/db/client';
import { listByDateRange } from '@/db/repository';
import { receipts } from '@/db/schema';
import { clearSampleData, seedSampleData } from '@/db/seed';
import { formatDailyLog } from '@/lib/format';

export function DevDataPanel() {
  const { data, updatedAt } = useLiveQuery(db.select({ n: count() }).from(receipts));
  const total = data[0]?.n ?? 0;

  const log = useMemo(() => {
    void updatedAt; // re-run whenever the receipts table changes
    const stored = listByDateRange(db, '0000-01-01', '9999-12-31');
    return formatDailyLog(stored, { grandTotal: true });
  }, [updatedAt]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Database (dev only)</Text>
      <Text>Receipts stored: {total}</Text>
      <View style={styles.row}>
        <Button label="Load sample data" onPress={() => seedSampleData(db)} />
        <Button label="Clear sample data" onPress={() => clearSampleData(db)} />
      </View>
      <Text selectable style={styles.log}>
        {log || 'No receipts yet.'}
      </Text>
    </ScrollView>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#2f6fed',
  },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '600' },
  log: { fontFamily: 'SpaceMono', fontSize: 12, lineHeight: 18 },
});
