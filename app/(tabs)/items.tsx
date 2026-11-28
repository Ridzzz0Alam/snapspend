/**
 * Items tracker (SPEC §2.5): every item across receipts in a FlashList, with sort, filters
 * (date range, stores, categories), text search and a footer total of the rows shown.
 * Tap an item for its price history.
 */
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { Button, usePalette } from '@/components/ui';
import { FONT } from '@/constants/fonts';
import { db } from '@/db/client';
import { listItems, listStores, type ItemListRow, type ItemSortKey } from '@/db/repository';
import { useReceiptsVersion } from '@/hooks/useReceiptsVersion';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import { isoFromDate } from '@/lib/dates';
import { formatLogDate } from '@/lib/format';
import { formatFt } from '@/lib/money';
import { effectiveUnitPrice, sumLineTotals } from '@/lib/priceHistory';
import { formatRange, normalizeRange, presetRange, type DateRange } from '@/lib/ranges';
import { matchesSearch } from '@/lib/search';

const SORTS: readonly { key: ItemSortKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'name', label: 'Name' },
  { key: 'store', label: 'Store' },
  { key: 'category', label: 'Category' },
];
const DEFAULT_DIR: Record<ItemSortKey, 'asc' | 'desc'> = {
  date: 'desc',
  amount: 'desc',
  name: 'asc',
  store: 'asc',
  category: 'asc',
};

type RangeChoice = 'all' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom';
const RANGE_CHOICES: readonly { key: RangeChoice; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'custom', label: 'Custom' },
];

interface Filters {
  range: RangeChoice;
  custom: DateRange;
  stores: string[];
  categories: string[];
}

function rangeOf(f: Filters, today: string): DateRange | null {
  if (f.range === 'all') return null;
  if (f.range === 'custom') return normalizeRange(f.custom);
  return presetRange(f.range, today);
}

export default function ItemsScreen() {
  const c = usePalette();
  const version = useReceiptsVersion();
  const today = isoFromDate(new Date());

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<ItemSortKey>('date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<Filters>(() => ({
    range: 'all',
    custom: presetRange('thisMonth', today),
    stores: [],
    categories: [],
  }));
  const [showFilters, setShowFilters] = useState(false);

  const range = rangeOf(filters, today);

  // SQL does filters + sort; text search runs in JS (accent-insensitive, D40) on top.
  const queried = useMemo(() => {
    void version;
    return listItems(
      db,
      {
        from: range?.from,
        to: range?.to,
        stores: filters.stores,
        categories: filters.categories,
      },
      { by: sortBy, dir },
    );
  }, [version, range?.from, range?.to, filters.stores, filters.categories, sortBy, dir]);

  const rows = useMemo(() => {
    const q = search.trim();
    return q ? queried.filter((r) => matchesSearch([r.nameEn, r.nameOriginal], q)) : queried;
  }, [queried, search]);

  const total = sumLineTotals(rows);
  const activeFilters =
    (filters.range !== 'all' ? 1 : 0) + filters.stores.length + filters.categories.length;

  function chooseSort(key: ItemSortKey) {
    if (key === sortBy) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setDir(DEFAULT_DIR[key]);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.top, { borderColor: c.border }]}>
        <View style={[styles.row, { backgroundColor: 'transparent' }]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search English or Hungarian name"
            placeholderTextColor={c.muted}
            autoCorrect={false}
            accessibilityLabel="Search items"
            style={[
              styles.search,
              { color: c.text, backgroundColor: c.field, borderColor: c.border },
            ]}
          />
          <Button
            label={activeFilters ? `Filters (${activeFilters})` : 'Filters'}
            kind={activeFilters ? 'primary' : 'secondary'}
            onPress={() => setShowFilters(true)}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {SORTS.map((s) => (
            <Chip
              key={s.key}
              label={s.key === sortBy ? `${s.label} ${dir === 'asc' ? '↑' : '↓'}` : s.label}
              selected={s.key === sortBy}
              onPress={() => chooseSort(s.key)}
              accessibilityLabel={`Sort by ${s.label}`}
            />
          ))}
        </ScrollView>
        {range && <Text style={[styles.rangeNote, { color: c.muted }]}>{formatRange(range)}</Text>}
      </View>

      <FlashList
        data={rows}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <ItemRow row={item} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.muted }]}>
            {queried.length === 0 && activeFilters === 0
              ? 'No items yet. Scan a receipt to start.'
              : 'No items match.'}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 8 }}
      />

      <View style={[styles.footer, { borderColor: c.border, backgroundColor: c.card }]}>
        <Text style={{ color: c.muted }}>
          {rows.length} item{rows.length === 1 ? '' : 's'}
        </Text>
        <Text style={styles.footerTotal}>{formatFt(total)}</Text>
      </View>

      <FilterSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        setFilters={setFilters}
        version={version}
      />
    </View>
  );
}

const ItemRow = memo(function ItemRow({ row }: { row: ItemListRow }) {
  const c = usePalette();
  const qty =
    row.unit === 'kg'
      ? `${row.quantity.toFixed(3)} kg × ${formatFt(effectiveUnitPrice(row))}/kg`
      : row.quantity !== 1
        ? `${row.quantity} × ${formatFt(effectiveUnitPrice(row))}`
        : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.nameEn}, ${formatFt(row.lineTotal)}, ${row.store}. Price history`}
      onPress={() => router.push({ pathname: '/item/[key]', params: { key: row.normalizedKey } })}
      style={({ pressed }) => [
        styles.item,
        { borderColor: c.border, backgroundColor: pressed ? c.field : 'transparent' },
      ]}
    >
      <View style={[styles.itemTop, { backgroundColor: 'transparent' }]}>
        <Text style={styles.itemName} numberOfLines={1}>
          {row.nameEn}
          {row.sizeLabel && !row.nameEn.toLowerCase().includes(row.sizeLabel.toLowerCase())
            ? ` ${row.sizeLabel}`
            : ''}
        </Text>
        <Text style={styles.itemAmount}>{formatFt(row.lineTotal)}</Text>
      </View>
      <Text style={[styles.itemMeta, { color: c.muted }]} numberOfLines={1}>
        {formatLogDate(row.date)} · {row.store} · {row.category}
        {qty ? ` · ${qty}` : ''}
      </Text>
    </Pressable>
  );
});

function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? c.primary : c.field, borderColor: c.border },
      ]}
    >
      <Text style={{ color: selected ? '#fff' : c.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

function FilterSheet({
  visible,
  onClose,
  filters,
  setFilters,
  version,
}: {
  visible: boolean;
  onClose: () => void;
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  version: string;
}) {
  const c = usePalette();
  const stores = useMemo(() => {
    void version;
    return visible ? listStores(db) : [];
  }, [visible, version]);

  function pickDate(which: 'from' | 'to') {
    DateTimePickerAndroid.open({
      value: isoToDate(filters.custom[which]),
      mode: 'date',
      maximumDate: new Date(),
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        setFilters((f) => ({ ...f, custom: { ...f.custom, [which]: isoFromDate(date) } }));
      },
    });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Filters</Text>

          <Text style={styles.sheetHeading}>Date</Text>
          <View style={[styles.wrap, { backgroundColor: 'transparent' }]}>
            {RANGE_CHOICES.map((r) => (
              <Chip
                key={r.key}
                label={r.label}
                selected={filters.range === r.key}
                onPress={() => setFilters((f) => ({ ...f, range: r.key }))}
              />
            ))}
          </View>
          {filters.range === 'custom' && (
            <View style={[styles.row, { backgroundColor: 'transparent' }]}>
              <Button
                label={`From ${formatLogDate(filters.custom.from)}`}
                kind="secondary"
                onPress={() => pickDate('from')}
                style={styles.flex}
              />
              <Button
                label={`To ${formatLogDate(filters.custom.to)}`}
                kind="secondary"
                onPress={() => pickDate('to')}
                style={styles.flex}
              />
            </View>
          )}

          <Text style={styles.sheetHeading}>Stores</Text>
          {stores.length === 0 && <Text style={{ color: c.muted }}>No stores yet.</Text>}
          <View style={[styles.wrap, { backgroundColor: 'transparent' }]}>
            {stores.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={filters.stores.includes(s)}
                onPress={() => setFilters((f) => ({ ...f, stores: toggle(f.stores, s) }))}
              />
            ))}
          </View>

          <Text style={styles.sheetHeading}>Categories</Text>
          <View style={[styles.wrap, { backgroundColor: 'transparent' }]}>
            {DEFAULT_CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                selected={filters.categories.includes(cat)}
                onPress={() => setFilters((f) => ({ ...f, categories: toggle(f.categories, cat) }))}
              />
            ))}
          </View>
        </ScrollView>
        <View style={[styles.sheetButtons, { borderColor: c.border }]}>
          <Button
            label="Clear all"
            kind="secondary"
            onPress={() => setFilters((f) => ({ ...f, range: 'all', stores: [], categories: [] }))}
            style={styles.flex}
          />
          <Button label="Show items" onPress={onClose} style={styles.flex} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { padding: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex: { flex: 1 },
  search: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: FONT.regular,
  },
  chips: { gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  rangeNote: { fontSize: 13 },
  item: {
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  itemName: { flex: 1, fontSize: 16, fontWeight: '500' },
  itemAmount: { fontSize: 16, fontWeight: '600' },
  itemMeta: { fontSize: 13 },
  empty: { padding: 24, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerTotal: { fontSize: 17, fontWeight: '700' },
  sheet: { flex: 1 },
  sheetContent: { padding: 16, gap: 12 },
  sheetTitle: { fontSize: 22, fontWeight: '700' },
  sheetHeading: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetButtons: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
