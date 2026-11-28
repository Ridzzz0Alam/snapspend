/**
 * Manual "Add expense" (SPEC §2.3): card-only slips with no item list and non-receipt spending.
 * Saved as a receipt with zero items: `total_only` when a slip photo is attached, else `manual` (D56).
 */
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';

import { Banner } from '@/components/form';
import { ReceiptForm } from '@/components/ReceiptForm';
import { Text, View } from '@/components/Themed';
import { Button, usePalette } from '@/components/ui';
import { saveReceipt } from '@/hooks/saveReceipt';
import { isoFromDate } from '@/lib/dates';
import { useNormalizeOptions } from '@/hooks/useLists';
import { emptyDraft, validateDraft, type DraftErrors, type ReceiptDraft } from '@/lib/reviewDraft';
import type { CompressedPage } from '@/lib/scanQueue';
import { compressPage, deleteTempFiles } from '@/media/receiptImages';

export default function NewExpenseScreen() {
  const c = usePalette();
  const lists = useNormalizeOptions();
  const [draft, setDraftState] = useState<ReceiptDraft>(() =>
    emptyDraft('manual', isoFromDate(new Date())),
  );
  const [errors, setErrors] = useState<DraftErrors>({});
  const [photo, setPhoto] = useState<CompressedPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setDraft = (update: (d: ReceiptDraft) => ReceiptDraft) => setDraftState(update);

  async function pickPhoto() {
    setMessage(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    setBusy(true);
    try {
      const page = await compressPage(res.assets[0].uri);
      if (photo) deleteTempFiles([photo.uri]);
      setPhoto(page);
    } catch {
      setMessage('This photo could not be opened.');
    } finally {
      setBusy(false);
    }
  }

  function removePhoto() {
    if (photo) deleteTempFiles([photo.uri]);
    setPhoto(null);
  }

  function onSave() {
    const result = validateDraft({ ...draft, kind: photo ? 'total_only' : 'manual' }, lists);
    if (!result.ok) {
      setErrors(result.errors);
      setMessage(`Fix ${Object.keys(result.errors).length} highlighted field(s) first.`);
      return;
    }
    const saved = saveReceipt(result.input, photo ? [photo] : []);
    if (!saved.ok) {
      setMessage(saved.message);
      return;
    }
    if (photo) deleteTempFiles([photo.uri]);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={{ color: c.muted }}>
          For card-only slips without an item list, or spending without a receipt (top-ups, coffee
          machine…).
        </Text>
        <ReceiptForm draft={draft} setDraft={setDraft} errors={errors} showItems={false} />

        <Text style={[styles.label, { color: c.muted }]}>Photo (optional)</Text>
        {photo ? (
          <View style={[styles.photoRow, { backgroundColor: 'transparent' }]}>
            <Image
              source={{ uri: photo.uri }}
              style={styles.photo}
              accessibilityLabel="Slip photo"
            />
            <Button label="Remove photo" kind="secondary" onPress={removePhoto} />
          </View>
        ) : (
          <Button
            label={busy ? 'Preparing photo…' : 'Add photo of the slip'}
            kind="secondary"
            onPress={pickPhoto}
            disabled={busy}
          />
        )}

        {message && <Banner tone="error">{message}</Banner>}
        <Button label="Save" onPress={onSave} disabled={busy} style={styles.save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  label: { fontSize: 13 },
  photoRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  photo: { width: 90, height: 120, borderRadius: 6, backgroundColor: '#888' },
  save: { minHeight: 52, marginTop: 8 },
});
