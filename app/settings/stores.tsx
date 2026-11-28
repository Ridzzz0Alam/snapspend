/**
 * Settings → Store names (SPEC §2.8, D73): store aliases. When a scanned or typed store name
 * matches a printed name here, the receipt is saved under the display name instead. After a save
 * the owner can also rename saved receipts that still use the printed name.
 */
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Banner, Field } from '@/components/form';
import { Text, View } from '@/components/Themed';
import { Button, IconButton, usePalette } from '@/components/ui';
import { db } from '@/db/client';
import {
  applyAliasToReceipts,
  countReceiptsWithStore,
  deleteStoreAlias,
  saveStoreAlias,
} from '@/db/lists';
import { listStores } from '@/db/repository';
import { useStoreAliases } from '@/hooks/useLists';
import { useReceiptsVersion } from '@/hooks/useReceiptsVersion';
import { checkStoreAlias, type StoreAlias } from '@/lib/normalize';

type Message = { tone: 'ok' | 'error'; text: string } | null;
type Form = { raw: string; canonical: string; editing?: string };

const receiptsText = (n: number) => `${n} saved receipt${n === 1 ? '' : 's'}`;

export default function StoreNamesScreen() {
  const c = usePalette();
  const aliases = useStoreAliases();
  const version = useReceiptsVersion();
  const [form, setForm] = useState<Form>({ raw: '', canonical: '' });
  const [errors, setErrors] = useState<{ raw?: string; canonical?: string }>({});
  const [message, setMessage] = useState<Message>(null);

  // Store names on saved receipts, as quick picks for the printed name (and existing display names).
  const stores = useMemo(() => {
    void version;
    return listStores(db);
  }, [version]);
  const suggestions = useMemo(() => {
    const used = new Set(aliases.flatMap((a) => [a.raw.toLowerCase(), a.canonical.toLowerCase()]));
    return stores.filter((s) => !used.has(s.toLowerCase()));
  }, [stores, aliases]);

  const setField = (k: 'raw' | 'canonical') => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function reset() {
    setForm({ raw: '', canonical: '' });
    setErrors({});
  }

  function onSave() {
    const problems = checkStoreAlias(form.raw, form.canonical, aliases, form.editing);
    if (problems) return setErrors(problems);
    let saved: StoreAlias;
    try {
      saved = saveStoreAlias(db, form, form.editing);
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
      return;
    }
    reset();
    const n = countReceiptsWithStore(db, saved.raw);
    setMessage({
      tone: 'ok',
      text: `New receipts from "${saved.raw}" show as "${saved.canonical}".`,
    });
    if (n > 0) {
      Alert.alert(
        'Rename saved receipts too?',
        `${receiptsText(n)} still say "${saved.raw}". Change them to "${saved.canonical}"?`,
        [
          { text: 'Leave them', style: 'cancel' },
          {
            text: 'Rename',
            onPress: () => {
              const changed = applyAliasToReceipts(db, saved);
              setMessage({
                tone: 'ok',
                text: `Saved, and ${receiptsText(changed)} renamed to "${saved.canonical}".`,
              });
            },
          },
        ],
      );
    }
  }

  function confirmDelete(alias: StoreAlias) {
    Alert.alert(
      `Remove "${alias.raw}"?`,
      `New receipts from "${alias.raw}" will keep the printed name. Saved receipts don't change.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            deleteStoreAlias(db, alias.raw);
            if (form.editing === alias.raw) reset();
            setMessage({ tone: 'ok', text: `Removed "${alias.raw}".` });
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.hint, { color: c.muted }]}>
          When a receipt&apos;s store matches a printed name (ignoring capitals and spaces), it is
          saved under the display name, e.g. INTERSPAR → SPAR (Interspar).
        </Text>

        <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
          <Text style={styles.heading}>
            {form.editing ? `Edit "${form.editing}"` : 'Add a store name'}
          </Text>
          <Field
            label="Printed name"
            value={form.raw}
            onChangeText={setField('raw')}
            error={errors.raw}
            placeholder="e.g. TESCO GLOBAL ÁRUHÁZAK"
            autoCapitalize="characters"
          />
          {!form.editing && suggestions.length > 0 && (
            <View style={[styles.chips, { backgroundColor: 'transparent' }]}>
              {suggestions.slice(0, 12).map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${s} as the printed name`}
                  onPress={() => setField('raw')(s)}
                  style={[styles.chip, { backgroundColor: c.field, borderColor: c.border }]}
                >
                  <Text numberOfLines={1}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Field
            label="Show as"
            value={form.canonical}
            onChangeText={setField('canonical')}
            error={errors.canonical}
            placeholder="e.g. TESCO"
            autoCapitalize="words"
          />
          <View style={[styles.actions, { backgroundColor: 'transparent' }]}>
            <Button
              label={form.editing ? 'Save' : 'Add'}
              onPress={onSave}
              disabled={!form.raw.trim() || !form.canonical.trim()}
            />
            {(form.editing || form.raw || form.canonical) && (
              <Button label="Cancel" kind="secondary" onPress={reset} />
            )}
          </View>
        </View>

        {message && <Banner tone={message.tone}>{message.text}</Banner>}

        {aliases.length === 0 ? (
          <Text style={[styles.hint, { color: c.muted }]}>No store names yet.</Text>
        ) : (
          <View style={[styles.list, { borderColor: c.border, backgroundColor: 'transparent' }]}>
            {aliases.map((a) => (
              <View key={a.raw} style={[styles.row, { borderColor: c.border }]}>
                <View style={[styles.flex, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.meta, { color: c.muted }]}>{a.raw}</Text>
                  <Text style={styles.name}>→ {a.canonical}</Text>
                </View>
                <IconButton
                  label="✎"
                  accessibilityLabel={`Edit ${a.raw}`}
                  onPress={() => {
                    setMessage(null);
                    setErrors({});
                    setForm({ raw: a.raw, canonical: a.canonical, editing: a.raw });
                  }}
                />
                <IconButton
                  label="✕"
                  accessibilityLabel={`Remove ${a.raw}`}
                  danger
                  onPress={() => confirmDelete(a)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  hint: { fontSize: 13, lineHeight: 18 },
  heading: { fontSize: 16, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    minHeight: 44,
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 4,
  },
  name: { fontSize: 16 },
  meta: { fontSize: 12 },
});
