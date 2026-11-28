/**
 * Editable receipt form (SPEC §2.2 Review): header fields, item rows, discounts/charges,
 * sanity-check banner and duplicate warning. Holds no state of its own; the screen owns the draft.
 */
import { randomUUID } from 'expo-crypto';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { db } from '@/db/client';
import { findDuplicates } from '@/db/repository';
import { useCategories, useStoreAliases } from '@/hooks/useLists';
import { parseDisplayDate } from '@/lib/dates';
import { formatFt, parseHuf } from '@/lib/money';
import { applyStoreAlias } from '@/lib/normalize';
import {
  blankAdjustment,
  blankItem,
  draftTotals,
  type AdjustmentDraft,
  type DraftErrors,
  type ItemDraft,
  type ReceiptDraft,
} from '@/lib/reviewDraft';
import type { AdjustmentType, ItemUnit } from '@/lib/types';

import { Banner, Field, Picker, Segmented } from './form';
import { Text, View } from './Themed';
import { Button, usePalette } from './ui';

const ADJ_TYPES: readonly AdjustmentType[] = ['discount', 'charge', 'points'];
const ADJ_LABELS: Record<AdjustmentType, string> = {
  discount: 'Discount',
  charge: 'Charge',
  points: 'Points',
};
const UNITS: readonly ItemUnit[] = ['pcs', 'kg'];

export function ReceiptForm({
  draft,
  setDraft,
  errors,
  showItems = true,
  excludeId,
}: {
  draft: ReceiptDraft;
  setDraft: (update: (d: ReceiptDraft) => ReceiptDraft) => void;
  errors: DraftErrors;
  showItems?: boolean;
  /** The receipt being edited (Receipt detail), so it isn't reported as its own duplicate. */
  excludeId?: string;
}) {
  const c = usePalette();
  const categories = useCategories();
  const aliases = useStoreAliases();
  const set =
    <K extends keyof ReceiptDraft>(k: K) =>
    (v: ReceiptDraft[K]) =>
      setDraft((d) => ({ ...d, [k]: v }));

  const updateItem = (key: string, patch: Partial<ItemDraft>) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    }));
  const removeItem = (key: string) =>
    setDraft((d) => ({ ...d, items: d.items.filter((it) => it.key !== key) }));
  const updateAdj = (key: string, patch: Partial<AdjustmentDraft>) =>
    setDraft((d) => ({
      ...d,
      adjustments: d.adjustments.map((a) => (a.key === key ? { ...a, ...patch } : a)),
    }));
  const removeAdj = (key: string) =>
    setDraft((d) => ({ ...d, adjustments: d.adjustments.filter((a) => a.key !== key) }));

  const totals = draftTotals(draft);
  const hasItems = draft.items.length > 0;

  // Duplicate guard (D19): only once store, date and total all parse.
  const duplicates = useMemo(() => {
    const date = parseDisplayDate(draft.date);
    const total = parseHuf(draft.printedTotal);
    if (!draft.store.trim() || !date || total == null) return [];
    try {
      return findDuplicates(
        db,
        { store: applyStoreAlias(draft.store, aliases), date, printedTotal: total },
        { excludeId },
      );
    } catch {
      return [];
    }
  }, [draft.store, draft.date, draft.printedTotal, excludeId, aliases]);

  return (
    <View style={[styles.form, { backgroundColor: 'transparent' }]}>
      {duplicates.length > 0 && (
        <Banner tone="warn">
          {`Possible duplicate: a receipt from ${duplicates[0]!.store} on this date with the same total is already saved. You can still save.`}
        </Banner>
      )}

      {showItems && hasItems && (
        <Banner tone={totals.ok ? 'ok' : 'warn'}>
          {totals.ok
            ? `✓ Items add up to the printed total (${formatFt(totals.printed)}).`
            : `Items add up to ${formatFt(totals.computed)}, receipt says ${formatFt(
                totals.printed,
              )} (difference ${formatFt(totals.diff)}). Check the rows below.`}
        </Banner>
      )}

      <Field
        label="Store"
        value={draft.store}
        onChangeText={set('store')}
        error={errors.store}
        autoCapitalize="words"
      />
      <View style={[styles.row, { backgroundColor: 'transparent' }]}>
        <Field
          label="Date (DD/MM/YYYY)"
          value={draft.date}
          onChangeText={set('date')}
          error={errors.date}
          keyboardType="numbers-and-punctuation"
          style={styles.flex2}
        />
        <Field
          label="Time"
          value={draft.time}
          onChangeText={set('time')}
          error={errors.time}
          placeholder="HH:MM"
          keyboardType="numbers-and-punctuation"
          style={styles.flex1}
        />
      </View>
      <View style={[styles.row, { backgroundColor: 'transparent' }]}>
        <Field
          label="Total paid (Ft)"
          value={draft.printedTotal}
          onChangeText={set('printedTotal')}
          error={errors.printedTotal}
          keyboardType="numeric"
          style={styles.flex2}
        />
        <Field
          label="Card last 4"
          value={draft.cardLast4}
          onChangeText={set('cardLast4')}
          error={errors.cardLast4}
          keyboardType="number-pad"
          style={styles.flex1}
        />
      </View>

      {showItems && (
        <>
          <Text style={styles.heading}>Items ({draft.items.length})</Text>
          {draft.items.map((it, i) => (
            <ItemRow
              key={it.key}
              item={it}
              index={i}
              errors={errors}
              onChange={updateItem}
              onRemove={removeItem}
              categories={categories}
            />
          ))}
          <Button
            label="+ Add item"
            kind="secondary"
            onPress={() => setDraft((d) => ({ ...d, items: [...d.items, blankItem(randomUUID)] }))}
          />

          <Text style={styles.heading}>Discounts, charges, points</Text>
          {draft.adjustments.length === 0 && (
            <Text style={{ color: c.muted }}>None on this receipt.</Text>
          )}
          {draft.adjustments.map((a) => (
            <View
              key={a.key}
              style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}
            >
              <Segmented
                options={ADJ_TYPES}
                labels={ADJ_LABELS}
                value={a.type}
                onChange={(type) => updateAdj(a.key, { type })}
              />
              <View style={[styles.row, { backgroundColor: 'transparent' }]}>
                <Field
                  placeholder="Label (e.g. Clubcard)"
                  value={a.label}
                  onChangeText={(label) => updateAdj(a.key, { label })}
                  error={errors[`adjustments.${a.key}.label`]}
                  style={styles.flex2}
                  small
                />
                <Field
                  placeholder="Ft"
                  value={a.amount}
                  onChangeText={(amount) => updateAdj(a.key, { amount })}
                  error={errors[`adjustments.${a.key}.amount`]}
                  keyboardType="numeric"
                  style={styles.flex1}
                  small
                />
                <RemoveButton
                  label={`Remove ${a.label || 'adjustment'}`}
                  onPress={() => removeAdj(a.key)}
                />
              </View>
            </View>
          ))}
          <Button
            label="+ Add discount / charge"
            kind="secondary"
            onPress={() =>
              setDraft((d) => ({
                ...d,
                adjustments: [...d.adjustments, blankAdjustment(randomUUID)],
              }))
            }
          />
          <Text style={[styles.hint, { color: c.muted }]}>
            Points (e.g. SPAR Repont) are a way of paying, so they don’t reduce the item total.
          </Text>
        </>
      )}

      {!showItems && (
        <CategoryField value={draft.category} onChange={set('category')} categories={categories} />
      )}

      <Field label="Note (optional)" value={draft.note} onChangeText={set('note')} />
    </View>
  );
}

const ItemRow = memo(function ItemRow({
  item,
  index,
  errors,
  onChange,
  onRemove,
  categories,
}: {
  item: ItemDraft;
  index: number;
  errors: DraftErrors;
  onChange: (key: string, patch: Partial<ItemDraft>) => void;
  onRemove: (key: string) => void;
  categories: readonly string[];
}) {
  const c = usePalette();
  const [picking, setPicking] = useState(false);
  const err = (f: string) => errors[`items.${item.key}.${f}`];
  return (
    <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
      <View style={[styles.row, { backgroundColor: 'transparent' }]}>
        <Field
          placeholder={`Item ${index + 1} (English name)`}
          value={item.nameEn}
          onChangeText={(nameEn) => onChange(item.key, { nameEn })}
          error={err('nameEn')}
          style={styles.flex2}
          small
        />
        <RemoveButton
          label={`Remove ${item.nameEn || `item ${index + 1}`}`}
          onPress={() => onRemove(item.key)}
        />
      </View>
      {item.nameOriginal ? (
        <Text style={[styles.original, { color: c.muted }]} numberOfLines={2}>
          {item.nameOriginal}
          {item.sizeLabel ? ` · ${item.sizeLabel}` : ''}
        </Text>
      ) : null}
      <View style={[styles.row, { backgroundColor: 'transparent' }]}>
        <Field
          label="Qty"
          value={item.quantity}
          onChangeText={(quantity) => onChange(item.key, { quantity })}
          error={err('quantity')}
          keyboardType="decimal-pad"
          style={styles.flex1}
          small
        />
        <View style={[styles.unit, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.smallLabel, { color: c.muted }]}>Unit</Text>
          <Segmented
            options={UNITS}
            value={item.unit}
            onChange={(unit) => onChange(item.key, { unit })}
          />
        </View>
        <Field
          label={item.unit === 'kg' ? 'Ft/kg' : 'Unit Ft'}
          value={item.unitPrice}
          onChangeText={(unitPrice) => onChange(item.key, { unitPrice })}
          error={err('unitPrice')}
          keyboardType="numeric"
          style={styles.flex1}
          small
        />
        <Field
          label="Total Ft"
          value={item.lineTotal}
          onChangeText={(lineTotal) => onChange(item.key, { lineTotal })}
          error={err('lineTotal')}
          keyboardType="numeric"
          style={styles.flex1}
          small
        />
      </View>
      <Picker
        label="Category"
        value={item.category}
        options={categories}
        onChange={(category) => onChange(item.key, { category })}
        visible={picking}
        setVisible={setPicking}
      />
    </View>
  );
});

const NO_CATEGORY = '(none)';

function CategoryField({
  value,
  onChange,
  categories,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: readonly string[];
}) {
  const c = usePalette();
  const [picking, setPicking] = useState(false);
  return (
    <View style={[styles.form, { backgroundColor: 'transparent', gap: 4 }]}>
      <Text style={[styles.smallLabel, { color: c.muted }]}>Category (optional)</Text>
      <Picker
        label="Category"
        value={value || NO_CATEGORY}
        options={[NO_CATEGORY, ...categories]}
        onChange={(v) => onChange(v === NO_CATEGORY ? '' : v)}
        visible={picking}
        setVisible={setPicking}
      />
    </View>
  );
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={styles.remove}
    >
      <Text style={{ color: c.error, fontSize: 20, fontWeight: '700' }}>✕</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  heading: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  original: { fontSize: 12 },
  unit: { gap: 4, width: 96 },
  smallLabel: { fontSize: 13 },
  hint: { fontSize: 12 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
