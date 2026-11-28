/**
 * Home (SPEC §2.1): this month's and today's totals, the last 5 receipts, and the big
 * Scan receipt / smaller Add expense buttons.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { Button, usePalette } from '@/components/ui';
import { db } from '@/db/client';
import { listByDateRange, listRecent } from '@/db/repository';
import { useReceiptsVersion } from '@/hooks/useReceiptsVersion';
import { useScanQueue } from '@/hooks/useScanQueue';
import { isoFromDate } from '@/lib/dates';
import { formatLogDate } from '@/lib/format';
import { monthLabel, sumTotals } from '@/lib/insights';
import { formatFt } from '@/lib/money';

export default function HomeScreen() {
  const c = usePalette();
  const version = useReceiptsVersion();
  const { jobs } = useScanQueue();
  const today = isoFromDate(new Date());

  const { monthTotal, todayTotal, monthCount, recent } = useMemo(() => {
    void version;
    const month = listByDateRange(db, `${today.slice(0, 7)}-01`, today);
    return {
      monthTotal: sumTotals(month),
      todayTotal: sumTotals(month.filter((r) => r.date === today)),
      monthCount: month.length,
      recent: listRecent(db, 5),
    };
  }, [version, today]);

  const waiting = jobs.filter((j) => j.status === 'ready').length;
  const busy = jobs.filter((j) => j.status !== 'ready' && j.status !== 'failed').length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.totals, { backgroundColor: 'transparent' }]}>
        <View
          style={[styles.card, styles.cardWide, { backgroundColor: c.card, borderColor: c.border }]}
        >
          <Text style={{ color: c.muted }}>{monthLabel(today.slice(0, 7))}</Text>
          <Text style={styles.big}>{formatFt(monthTotal)}</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {monthCount} receipt{monthCount === 1 ? '' : 's'} this month
          </Text>
        </View>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ color: c.muted }}>Today</Text>
          <Text style={styles.medium}>{formatFt(todayTotal)}</Text>
        </View>
      </View>

      <Button label="Scan receipt" onPress={() => router.navigate('/scan')} style={styles.scan} />
      <Button label="Add expense" kind="secondary" onPress={() => router.push('/expense/new')} />

      {(waiting > 0 || busy > 0) && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate('/scan')}
          style={[styles.queue, { borderColor: c.warn, backgroundColor: c.warnBg }]}
        >
          <Text style={{ color: c.warn }}>
            {waiting > 0
              ? `${waiting} receipt${waiting === 1 ? '' : 's'} ready to review →`
              : `${busy} receipt${busy === 1 ? '' : 's'} being read…`}
          </Text>
        </Pressable>
      )}

      <View style={[styles.headingRow, { backgroundColor: 'transparent' }]}>
        <Text style={styles.heading}>Recent receipts</Text>
        <Pressable accessibilityRole="link" onPress={() => router.navigate('/log')} hitSlop={8}>
          <Text style={{ color: c.link }}>Daily Log →</Text>
        </Pressable>
      </View>
      {recent.length === 0 && (
        <Text style={{ color: c.muted }}>No receipts yet. Scan one to get started.</Text>
      )}
      {recent.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          accessibilityLabel={`${r.store}, ${formatLogDate(r.date)}. Open receipt`}
          onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })}
          style={({ pressed }) => [
            styles.row,
            { borderColor: c.border, backgroundColor: pressed ? c.field : 'transparent' },
          ]}
        >
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Text style={styles.store} numberOfLines={1}>
              {r.store}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {formatLogDate(r.date)}
              {r.time ? ` ${r.time}` : ''}
              {r.kind !== 'scanned' ? ` · ${r.kind === 'manual' ? 'manual' : 'total only'}` : ''}
            </Text>
          </View>
          <Text style={styles.amount}>
            {formatFt(r.kind === 'scanned' ? r.computedTotal : r.printedTotal)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  totals: { flexDirection: 'row', gap: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4, flex: 1 },
  cardWide: { flex: 1.6 },
  big: { fontSize: 26, fontWeight: '700' },
  medium: { fontSize: 20, fontWeight: '700' },
  scan: { minHeight: 64 },
  queue: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 44, justifyContent: 'center' },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  heading: { fontSize: 17, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  store: { fontSize: 16, fontWeight: '500' },
  amount: { fontSize: 16, fontWeight: '600' },
});
