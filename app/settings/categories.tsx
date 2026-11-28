/**
 * Settings → Categories (SPEC §2.8, D73): add, rename, delete and reorder. The list is what
 * Gemini is asked to choose from and what every picker and filter shows. Renaming or deleting
 * also updates saved items; "Other" is the fallback and stays.
 */
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';

import { Banner, Field } from '@/components/form';
import { Text, View } from '@/components/Themed';
import { Button, IconButton, usePalette } from '@/components/ui';
import { db } from '@/db/client';
import {
  addCategory,
  categoryUsage,
  deleteCategory,
  moveCategory,
  renameCategory,
} from '@/db/lists';
import { useCategories } from '@/hooks/useLists';
import { useReceiptsVersion } from '@/hooks/useReceiptsVersion';
import { checkCategoryName, cleanName, FALLBACK_CATEGORY } from '@/lib/categories';

type Message = { tone: 'ok' | 'error'; text: string } | null;

const receiptsText = (n: number) => `${n} saved receipt${n === 1 ? '' : 's'}`;

export default function CategoriesScreen() {
  const c = usePalette();
  const list = useCategories();
  const version = useReceiptsVersion();
  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState<string>();
  const [editing, setEditing] = useState<{ from: string; to: string; error?: string } | null>(null);
  const [message, setMessage] = useState<Message>(null);

  // Item counts per category, refreshed when receipts or the list change.
  const usage = useMemo(() => {
    void version;
    return new Map(list.map((name) => [name, categoryUsage(db, name)]));
  }, [list, version]);

  function run(task: () => string) {
    try {
      setMessage({ tone: 'ok', text: task() });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  }

  function onAdd() {
    const error = checkCategoryName(newName, list);
    setNewError(error ?? undefined);
    if (error) return;
    run(() => `Added "${addCategory(db, newName)}".`);
    setNewName('');
  }

  function onRename() {
    if (!editing) return;
    const error = checkCategoryName(editing.to, list, editing.from);
    if (error) return setEditing({ ...editing, error });
    const to = cleanName(editing.to);
    setEditing(null);
    if (to === editing.from) return;
    run(() => {
      const n = renameCategory(db, editing.from, to);
      return `Renamed "${editing.from}" to "${to}"${n ? `; ${receiptsText(n)} updated` : ''}.`;
    });
  }

  function confirmDelete(name: string) {
    const used = usage.get(name);
    const detail = used?.receipts
      ? `${used.items} item${used.items === 1 ? '' : 's'} on ${receiptsText(used.receipts)} will move to "${FALLBACK_CATEGORY}".`
      : 'No saved receipts use it.';
    Alert.alert(`Delete "${name}"?`, detail, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          run(() => {
            const n = deleteCategory(db, name);
            return `Deleted "${name}"${n ? `; ${receiptsText(n)} moved to "${FALLBACK_CATEGORY}"` : ''}.`;
          }),
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.hint, { color: c.muted }]}>
          Gemini sorts every item into one of these. The order here is the order in pickers and
          filters. Renaming or deleting also changes saved items.
        </Text>

        <View style={[styles.addRow, { backgroundColor: 'transparent' }]}>
          <Field
            label="New category"
            value={newName}
            onChangeText={(v) => {
              setNewName(v);
              setNewError(undefined);
            }}
            error={newError}
            autoCapitalize="sentences"
            style={styles.flex}
          />
          <Button label="Add" onPress={onAdd} disabled={!newName.trim()} style={styles.addButton} />
        </View>

        {message && <Banner tone={message.tone}>{message.text}</Banner>}

        <View style={[styles.list, { borderColor: c.border, backgroundColor: 'transparent' }]}>
          {list.map((name, i) => {
            const isFallback = name === FALLBACK_CATEGORY;
            const items = usage.get(name)?.items ?? 0;
            if (editing?.from === name) {
              return (
                <View
                  key={name}
                  style={[styles.editRow, { borderColor: c.border, backgroundColor: c.card }]}
                >
                  <Field
                    label={`Rename "${name}"`}
                    value={editing.to}
                    onChangeText={(to) => setEditing({ from: name, to })}
                    error={editing.error}
                  />
                  <View style={[styles.actions, { backgroundColor: 'transparent' }]}>
                    <Button label="Save" onPress={onRename} disabled={!editing.to.trim()} />
                    <Button label="Cancel" kind="secondary" onPress={() => setEditing(null)} />
                  </View>
                </View>
              );
            }
            return (
              <View key={name} style={[styles.row, { borderColor: c.border }]}>
                <View style={[styles.flex, { backgroundColor: 'transparent' }]}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={[styles.meta, { color: c.muted }]}>
                    {items} item{items === 1 ? '' : 's'}
                    {isFallback ? ' · fallback, always kept' : ''}
                  </Text>
                </View>
                <IconButton
                  label="↑"
                  accessibilityLabel={`Move ${name} up`}
                  disabled={i === 0}
                  onPress={() => moveCategory(db, name, -1)}
                />
                <IconButton
                  label="↓"
                  accessibilityLabel={`Move ${name} down`}
                  disabled={i === list.length - 1}
                  onPress={() => moveCategory(db, name, 1)}
                />
                {!isFallback && (
                  <>
                    <IconButton
                      label="✎"
                      accessibilityLabel={`Rename ${name}`}
                      onPress={() => {
                        setMessage(null);
                        setEditing({ from: name, to: name });
                      }}
                    />
                    <IconButton
                      label="✕"
                      accessibilityLabel={`Delete ${name}`}
                      danger
                      onPress={() => confirmDelete(name)}
                    />
                  </>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  hint: { fontSize: 13, lineHeight: 18 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  addButton: { marginBottom: 1 },
  flex: { flex: 1 },
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 4,
  },
  editRow: { padding: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: 10 },
  name: { fontSize: 16 },
  meta: { fontSize: 12 },
});
