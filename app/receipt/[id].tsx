/**
 * Receipt detail (SPEC §2.7): receipt image (tap to zoom), all fields editable, delete receipt.
 * Delete is a soft delete (D44): the receipt disappears everywhere but stays in the database
 * for sync. Images are kept until the retention setting (Phase 8, D46) removes them.
 */
import { randomUUID } from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { Banner } from '@/components/form';
import { ReceiptForm } from '@/components/ReceiptForm';
import { Text, View } from '@/components/Themed';
import { Button, usePalette } from '@/components/ui';
import { ImageViewer } from '@/components/ZoomableImage';
import { db } from '@/db/client';
import { deleteReceipt, getReceipt, updateReceipt, type StoredReceipt } from '@/db/repository';
import { formatLogDate } from '@/lib/format';
import { formatFt } from '@/lib/money';
import {
  draftFromStored,
  validateDraft,
  type DraftErrors,
  type ReceiptDraft,
} from '@/lib/reviewDraft';
import { receiptTotal } from '@/lib/totals';

function parseImagePaths(json: string | null): string[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Loaded once; the form keeps its own copy until saved.
  const [stored, setStored] = useState(() => (id ? getReceipt(db, id) : null));

  if (!stored) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Receipt' }} />
        <Text>This receipt no longer exists.</Text>
        <Button label="Back" onPress={() => router.back()} />
      </View>
    );
  }
  return <DetailForm key={stored.updatedAt} stored={stored} onSaved={setStored} />;
}

function DetailForm({
  stored,
  onSaved,
}: {
  stored: StoredReceipt;
  onSaved: (r: StoredReceipt) => void;
}) {
  const c = usePalette();
  const images = useMemo(() => parseImagePaths(stored.imagePaths), [stored.imagePaths]);
  const [viewer, setViewer] = useState<number | null>(null);
  const [draft, setDraftState] = useState<ReceiptDraft>(() => draftFromStored(stored, randomUUID));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const setDraft = (update: (d: ReceiptDraft) => ReceiptDraft) => {
    setDraftState(update);
    setDirty(true);
    setMessage(null);
  };

  function save() {
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      setMessage({
        tone: 'error',
        text: `Fix ${Object.keys(result.errors).length} highlighted field(s) first.`,
      });
      return;
    }
    setErrors({});
    try {
      // Keep the saved photos; the form doesn't edit them.
      const ok = updateReceipt(db, stored.id, {
        ...result.input,
        imagePaths: images.length ? images : null,
      });
      const fresh = ok ? getReceipt(db, stored.id) : null;
      if (!fresh) {
        setMessage({
          tone: 'error',
          text: 'This receipt was deleted meanwhile; nothing was saved.',
        });
        return;
      }
      setDirty(false);
      onSaved(fresh); // re-mounts the form with the saved values
    } catch (e) {
      setMessage({
        tone: 'error',
        text: `Could not save.${e instanceof Error ? `\n(${e.message})` : ''}`,
      });
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete receipt?',
      `${stored.store}, ${formatLogDate(stored.date)}, ${formatFt(receiptTotal(stored))}. It will disappear from every list and total.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteReceipt(db, stored.id);
            router.back();
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <Stack.Screen options={{ title: `${stored.store} · ${formatLogDate(stored.date)}` }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {images.length > 0 ? (
          <ScrollView horizontal contentContainerStyle={styles.pages}>
            {images.map((uri, i) => (
              <Pressable
                key={uri}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Receipt page ${i + 1}, open full screen`}
                onPress={() => setViewer(i)}
              >
                <Image source={{ uri }} style={styles.page} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={{ color: c.muted }}>No photo for this receipt.</Text>
        )}
        {images.length > 0 && (
          <Text style={[styles.hint, { color: c.muted }]}>Tap a page to zoom.</Text>
        )}

        <ReceiptForm
          draft={draft}
          setDraft={setDraft}
          errors={errors}
          showItems={stored.kind === 'scanned' || stored.items.length > 0}
          excludeId={stored.id}
        />

        {message && <Banner tone={message.tone}>{message.text}</Banner>}
        {!dirty && !message && (
          <Text style={[styles.hint, { color: c.muted }]}>
            Saved {new Date(stored.updatedAt).toLocaleString()}
          </Text>
        )}

        <Button label="Save changes" onPress={save} disabled={!dirty} style={styles.save} />
        <Button label="Delete receipt" kind="danger" onPress={confirmDelete} />
      </ScrollView>
      <ImageViewer uris={images} index={viewer} onClose={() => setViewer(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  pages: { gap: 8 },
  page: { width: 150, height: 200, borderRadius: 6, backgroundColor: '#888' },
  hint: { fontSize: 12 },
  save: { minHeight: 52, marginTop: 8 },
});
