/**
 * Price history for one product (SPEC §2.5): unit price over time, cheapest store, last paid.
 * Products are matched by normalizedKey (English name + size, lowercased).
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { Text, View } from '@/components/Themed';
import { usePalette, type Palette } from '@/components/ui';
import { FONT } from '@/constants/fonts';
import { db } from '@/db/client';
import { listItems } from '@/db/repository';
import { useReceiptsVersion } from '@/hooks/useReceiptsVersion';
import { formatLogDate } from '@/lib/format';
import { formatFt } from '@/lib/money';
import { priceHistory, type PricePoint } from '@/lib/priceHistory';

export default function PriceHistoryScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const c = usePalette();
  const version = useReceiptsVersion();
  const { width } = useWindowDimensions();

  const rows = useMemo(() => {
    void version;
    return key ? listItems(db, { normalizedKey: key }, { by: 'date', dir: 'desc' }) : [];
  }, [key, version]);
  const history = useMemo(() => priceHistory(rows), [rows]);

  const latest = rows[0];
  const title = latest
    ? `${latest.nameEn}${latest.sizeLabel && !latest.nameEn.toLowerCase().includes(latest.sizeLabel.toLowerCase()) ? ` ${latest.sizeLabel}` : ''}`
    : 'Price history';

  if (!history) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title }} />
        <Text style={{ color: c.muted }}>No purchases of this item yet.</Text>
      </View>
    );
  }

  const per = history.unit === 'kg' ? '/kg' : '';
  const chartWidth = width - 32 - 56;
  const n = history.points.length;
  const spacing = n > 1 ? Math.max(28, Math.min(80, (chartWidth - 30) / (n - 1))) : 40;
  const prices = history.points.map((p) => p.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  // Leave headroom so the line isn't glued to the top edge; start the axis near the lowest price.
  const yOffset = Math.max(0, Math.floor((minPrice * 0.8) / 10) * 10);
  const data = history.points.map((p, i) => ({
    value: p.price - yOffset,
    label: i === 0 || i === n - 1 || n <= 6 ? formatLogDate(p.date).slice(0, 5) : '',
  }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title }} />
      {latest?.nameOriginal ? <Text style={{ color: c.muted }}>{latest.nameOriginal}</Text> : null}

      <View style={[styles.stats, { backgroundColor: 'transparent' }]}>
        <Stat label="Last paid" point={history.last} per={per} c={c} />
        <Stat label="Cheapest" point={history.cheapest} per={per} c={c} highlight />
      </View>
      <Text style={{ color: c.muted }}>
        Average {formatFt(history.average)}
        {per} · bought {history.timesBought} time{history.timesBought === 1 ? '' : 's'} · spent{' '}
        {formatFt(history.totalSpent)}
      </Text>

      <Text style={styles.heading}>Unit price over time</Text>
      <View style={[styles.chartBox, { borderColor: c.border, backgroundColor: c.card }]}>
        <LineChart
          data={data}
          width={chartWidth}
          height={180}
          spacing={spacing}
          initialSpacing={16}
          endSpacing={16}
          adjustToWidth={n > 1 && (n - 1) * spacing < chartWidth}
          color={c.primary}
          thickness={2}
          dataPointsColor={c.primary}
          dataPointsRadius={4}
          noOfSections={4}
          maxValue={Math.max(1, Math.ceil(((maxPrice - yOffset) * 1.15) / 10) * 10)}
          yAxisLabelWidth={56}
          formatYLabel={(v) => formatFt(Number(v) + yOffset).replace('.00 Ft', '')}
          yAxisTextStyle={{ color: c.muted, fontSize: 11, fontFamily: FONT.regular }}
          xAxisLabelTextStyle={{ color: c.muted, fontSize: 11, fontFamily: FONT.regular }}
          rulesColor={c.border}
          yAxisColor={c.border}
          xAxisColor={c.border}
          isAnimated
        />
      </View>
      {n === 1 && (
        <Text style={{ color: c.muted }}>
          Bought once so far. The line appears from the 2nd purchase.
        </Text>
      )}

      <Text style={styles.heading}>Purchases</Text>
      {[...history.points].reverse().map((p, i) => (
        <View
          key={`${p.date}-${p.store}-${i}`}
          style={[styles.purchase, { borderColor: c.border, backgroundColor: 'transparent' }]}
        >
          <View style={{ backgroundColor: 'transparent', flex: 1 }}>
            <Text style={styles.purchaseStore}>{p.store}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {formatLogDate(p.date)}
              {p.time ? ` ${p.time}` : ''} ·{' '}
              {history.unit === 'kg' ? `${p.quantity.toFixed(3)} kg` : `${p.quantity} pcs`}
            </Text>
          </View>
          <View style={{ backgroundColor: 'transparent', alignItems: 'flex-end' }}>
            <Text style={styles.purchasePrice}>
              {formatFt(p.price)}
              {per}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>paid {formatFt(p.lineTotal)}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Stat({
  label,
  point,
  per,
  c,
  highlight,
}: {
  label: string;
  point: PricePoint;
  per: string;
  c: Palette;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        styles.stat,
        {
          borderColor: highlight ? c.ok : c.border,
          backgroundColor: highlight ? c.okBg : c.card,
        },
      ]}
    >
      <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      <Text style={styles.statPrice}>
        {formatFt(point.price)}
        {per}
      </Text>
      <Text style={{ fontSize: 13 }} numberOfLines={1}>
        {point.store}
      </Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>{formatLogDate(point.date)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, gap: 2 },
  statPrice: { fontSize: 20, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  chartBox: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, overflow: 'hidden' },
  purchase: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  purchaseStore: { fontSize: 15, fontWeight: '500' },
  purchasePrice: { fontSize: 15, fontWeight: '600' },
});
