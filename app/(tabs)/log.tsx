/**
 * Daily Log (SPEC §2.4): pick a range, see the §6 text in a monospace selectable block,
 * Copy / Share it, optionally with GRAND TOTAL.
 */
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { max, count } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch } from 'react-native';

import { Text, View } from '@/components/Themed';
import { Button, usePalette } from '@/components/ui';
import { MONO_FONT } from '@/constants/fonts';
import { db } from '@/db/client';
import { listByDateRange, notDeleted } from '@/db/repository';
import { receipts } from '@/db/schema';
import { isoFromDate } from '@/lib/dates';
import { formatDailyLog } from '@/lib/format';
import { formatFt } from '@/lib/money';
import {
  defaultGrandTotal,
  formatRange,
  normalizeRange,
  presetRange,
  RANGE_PRESETS,
  type DateRange,
  type RangePreset,
} from '@/lib/ranges';
import { receiptTotal } from '@/lib/totals';

type Choice = RangePreset | 'custom';

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export default function DailyLogScreen() {
  const c = usePalette();
  const today = isoFromDate(new Date());
  const [choice, setChoice] = useState<Choice>('thisWeek');
  const [custom, setCustom] = useState<DateRange>(() => presetRange('thisWeek', today));
  const range = choice === 'custom' ? normalizeRange(custom) : presetRange(choice, today);

  const [grandTotal, setGrandTotal] = useState(() => defaultGrandTotal(range));
  const [copied, setCopied] = useState(false);

  // Reset the GRAND TOTAL switch to the SPEC default whenever the range changes.
  const rangeKey = `${range.from}|${range.to}`;
  const [lastRangeKey, setLastRangeKey] = useState(rangeKey);
  if (rangeKey !== lastRangeKey) {
    setLastRangeKey(rangeKey);
    setGrandTotal(defaultGrandTotal(range));
    setCopied(false);
  }

  // Re-run whenever receipts change (save, edit, delete).
  const { data: signal } = useLiveQuery(
    db
      .select({ n: count(), changed: max(receipts.updatedAt) })
      .from(receipts)
      .where(notDeleted),
  );
  const changeKey = `${signal[0]?.n ?? 0}|${signal[0]?.changed ?? 0}`;

  const { text, receiptCount, total } = useMemo(() => {
    void changeKey;
    const list = listByDateRange(db, range.from, range.to);
    return {
      text: formatDailyLog(list, { grandTotal }),
      receiptCount: list.length,
      total: list.reduce((sum, r) => sum + receiptTotal(r), 0),
    };
  }, [range.from, range.to, grandTotal, changeKey]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  function pickDate(which: 'from' | 'to') {
    DateTimePickerAndroid.open({
      value: isoToDate(custom[which]),
      mode: 'date',
      maximumDate: new Date(),
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        setCustom((r) => ({ ...r, [which]: isoFromDate(date) }));
      },
    });
  }

  async function copy() {
    await Clipboard.setStringAsync(text);
    setCopied(true);
  }

  async function share() {
    await Share.share({ message: text });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {[...RANGE_PRESETS, { key: 'custom' as const, label: 'Custom' }].map((p) => {
          const selected = choice === p.key;
          return (
            <Pressable
              key={p.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                if (p.key === 'custom' && choice !== 'custom') setCustom(range);
                setChoice(p.key);
              }}
              style={[
                styles.chip,
                { backgroundColor: selected ? c.primary : c.field, borderColor: c.border },
              ]}
            >
              <Text style={{ color: selected ? '#fff' : c.text, fontWeight: '600' }}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {choice === 'custom' && (
        <View style={[styles.row, { backgroundColor: 'transparent' }]}>
          <Button
            label={`From ${formatRange({ from: custom.from, to: custom.from })}`}
            kind="secondary"
            onPress={() => pickDate('from')}
            style={styles.flex}
          />
          <Button
            label={`To ${formatRange({ from: custom.to, to: custom.to })}`}
            kind="secondary"
            onPress={() => pickDate('to')}
            style={styles.flex}
          />
        </View>
      )}

      <Text style={[styles.summary, { color: c.muted }]}>
        {formatRange(range)} · {receiptCount} receipt{receiptCount === 1 ? '' : 's'} ·{' '}
        {formatFt(total)}
      </Text>

      <View style={[styles.switchRow, { backgroundColor: 'transparent' }]}>
        <Text style={styles.switchLabel}>Include GRAND TOTAL</Text>
        <Switch
          value={grandTotal}
          onValueChange={setGrandTotal}
          accessibilityLabel="Include GRAND TOTAL"
          trackColor={{ true: c.primary }}
        />
      </View>

      <View style={[styles.logBox, { backgroundColor: c.card, borderColor: c.border }]}>
        {text ? (
          <Text selectable style={[styles.log, { fontFamily: MONO_FONT }]}>
            {text}
          </Text>
        ) : (
          <Text style={{ color: c.muted }}>No receipts in this range.</Text>
        )}
      </View>

      <View style={[styles.row, { backgroundColor: 'transparent' }]}>
        <Button
          label={copied ? 'Copied ✓' : 'Copy'}
          onPress={copy}
          disabled={!text}
          style={styles.flex}
        />
        <Button
          label="Share"
          kind="secondary"
          onPress={share}
          disabled={!text}
          style={styles.flex}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  chips: { gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  summary: { fontSize: 14 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  switchLabel: { fontSize: 16 },
  logBox: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 120 },
  log: { fontSize: 13, lineHeight: 20 },
});
