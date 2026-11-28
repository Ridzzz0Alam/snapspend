/**
 * Insights (SPEC §2.6): monthly totals for the last 12 months; spending by store, category and
 * card for the selected month; the 10 most-bought items over the last 12 months (D68).
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { Text, View } from '@/components/Themed';
import { usePalette, type Palette } from '@/components/ui';
import { FONT } from '@/constants/fonts';
import { db } from '@/db/client';
import { listByDateRange } from '@/db/repository';
import { useReceiptsVersion } from '@/hooks/useReceiptsVersion';
import { isoFromDate } from '@/lib/dates';
import {
  ADJUSTMENTS_LABEL,
  lastNMonths,
  monthLabel,
  monthlyTotals,
  sumTotals,
  topItems,
  totalsByCard,
  totalsByCategory,
  totalsByStore,
  type LabelTotal,
} from '@/lib/insights';
import { formatFt } from '@/lib/money';

/** Axis labels: `12,500` → `12.5k`. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(n));
}

export default function InsightsScreen() {
  const c = usePalette();
  const version = useReceiptsVersion();
  const { width } = useWindowDimensions();
  const today = isoFromDate(new Date());
  const months = useMemo(() => lastNMonths(today, 12), [today]);
  const [selected, setSelected] = useState(months[months.length - 1]!);

  const all = useMemo(() => {
    void version;
    return listByDateRange(db, `${months[0]}-01`, today);
  }, [version, months, today]);

  const monthly = useMemo(() => monthlyTotals(all, months), [all, months]);
  const inMonth = useMemo(() => all.filter((r) => r.date.startsWith(selected)), [all, selected]);
  const stores = useMemo(() => totalsByStore(inMonth), [inMonth]);
  const categories = useMemo(() => totalsByCategory(inMonth), [inMonth]);
  const cards = useMemo(() => totalsByCard(inMonth), [inMonth]);
  const top = useMemo(() => topItems(all, 10), [all]);
  const monthTotal = sumTotals(inMonth);

  const index = months.indexOf(selected);
  const chartWidth = width - 32 - 24 - 44;
  const barSpace = chartWidth / 12;
  const maxMonth = Math.max(...monthly.map((m) => m.total), 1);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Last 12 months</Text>
      <View style={[styles.chartBox, { borderColor: c.border, backgroundColor: c.card }]}>
        <BarChart
          data={monthly.map((m) => ({
            value: m.total,
            label: monthLabel(m.month, { short: true }).slice(0, 1),
            frontColor: m.month === selected ? c.primary : c.dark ? '#3a4a6b' : '#b8c8ee',
            onPress: () => setSelected(m.month),
          }))}
          width={chartWidth}
          height={160}
          barWidth={barSpace * 0.6}
          spacing={barSpace * 0.4}
          initialSpacing={barSpace * 0.2}
          barBorderRadius={3}
          noOfSections={4}
          maxValue={Math.ceil((maxMonth * 1.1) / 1000) * 1000 || 1000}
          yAxisLabelWidth={44}
          formatYLabel={(v) => compact(Number(v))}
          yAxisTextStyle={{ color: c.muted, fontSize: 10, fontFamily: FONT.regular }}
          xAxisLabelTextStyle={{ color: c.muted, fontSize: 10, fontFamily: FONT.regular }}
          rulesColor={c.border}
          yAxisColor={c.border}
          xAxisColor={c.border}
          isAnimated
        />
      </View>

      <View style={[styles.monthRow, { backgroundColor: 'transparent' }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          disabled={index <= 0}
          onPress={() => setSelected(months[index - 1]!)}
          style={[styles.arrow, { backgroundColor: c.field }, index <= 0 && styles.dim]}
        >
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <View style={{ alignItems: 'center', backgroundColor: 'transparent' }}>
          <Text style={styles.monthTitle}>{monthLabel(selected)}</Text>
          <Text style={{ color: c.muted }}>
            {formatFt(monthTotal)} · {inMonth.length} receipt{inMonth.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={index >= months.length - 1}
          onPress={() => setSelected(months[index + 1]!)}
          style={[
            styles.arrow,
            { backgroundColor: c.field },
            index >= months.length - 1 && styles.dim,
          ]}
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      {inMonth.length === 0 ? (
        <Text style={{ color: c.muted, textAlign: 'center' }}>No spending this month.</Text>
      ) : (
        <>
          <Section title="By store" rows={stores} c={c} />
          <Section title="By category" rows={categories} c={c} />
          <Section
            title="By card"
            rows={cards.map((k) => ({
              label: k.card ? `•••• ${k.card}` : 'No card (cash / unknown)',
              total: k.total,
              note: `${k.count} receipt${k.count === 1 ? '' : 's'}`,
            }))}
            c={c}
          />
        </>
      )}

      <Text style={styles.heading}>Most bought (last 12 months)</Text>
      {top.length === 0 && <Text style={{ color: c.muted }}>No items yet.</Text>}
      {top.map((t, i) => (
        <Pressable
          key={t.key}
          accessibilityRole="button"
          accessibilityLabel={`${t.name}, bought ${t.count} times. Price history`}
          onPress={() => router.push({ pathname: '/item/[key]', params: { key: t.key } })}
          style={({ pressed }) => [
            styles.topRow,
            { borderColor: c.border, backgroundColor: pressed ? c.field : 'transparent' },
          ]}
        >
          <Text style={[styles.rank, { color: c.muted }]}>{i + 1}</Text>
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Text style={styles.topName} numberOfLines={1}>
              {t.name}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {t.count}× · avg {formatFt(t.averagePrice)}
              {t.unit === 'kg' ? '/kg' : ''}
            </Text>
          </View>
          <Text style={styles.amount}>{formatFt(t.totalSpent)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Section({
  title,
  rows,
  c,
}: {
  title: string;
  rows: (LabelTotal & { note?: string })[];
  c: Palette;
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.total)), 1);
  return (
    <View style={[styles.section, { backgroundColor: 'transparent' }]}>
      <Text style={styles.heading}>{title}</Text>
      {rows.map((r) => {
        const negative = r.total < 0;
        return (
          <View key={r.label} style={[styles.barRow, { backgroundColor: 'transparent' }]}>
            <View style={[styles.barLabels, { backgroundColor: 'transparent' }]}>
              <Text style={styles.barLabel} numberOfLines={1}>
                {r.label}
                {r.note ? <Text style={{ color: c.muted }}> · {r.note}</Text> : null}
              </Text>
              <Text style={[styles.barAmount, negative && { color: c.ok }]}>
                {formatFt(r.total)}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: c.field }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.max(2, (Math.abs(r.total) / max) * 100)}%`,
                    backgroundColor:
                      r.label === ADJUSTMENTS_LABEL ? c.ok : negative ? c.ok : c.primary,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  heading: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  chartBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingLeft: 4,
    overflow: 'hidden',
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 24 },
  dim: { opacity: 0.3 },
  monthTitle: { fontSize: 20, fontWeight: '700' },
  section: { gap: 10 },
  barRow: { gap: 4 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  barLabel: { flex: 1, fontSize: 14 },
  barAmount: { fontSize: 14, fontWeight: '600' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 20, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  topName: { fontSize: 15, fontWeight: '500' },
  amount: { fontSize: 15, fontWeight: '600' },
});
