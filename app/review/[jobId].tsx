/**
 * Review screen (SPEC §2.2 step 3): always shown before saving a scanned receipt.
 * Edit everything, then Save (one transaction), Retry with Gemini, or Discard.
 */
import { randomUUID } from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { Banner } from '@/components/form';
import { ReceiptForm } from '@/components/ReceiptForm';
import { Text, View } from '@/components/Themed';
import { Button, usePalette } from '@/components/ui';
import { saveReceipt } from '@/hooks/saveReceipt';
import { useNormalizeOptions } from '@/hooks/useLists';
import { removeJob, retryJob, useScanJob } from '@/hooks/useScanQueue';
import { isoFromDate } from '@/lib/dates';
import { normalizeReceipt, type NormalizeOptions } from '@/lib/normalize';
import {
  draftFromExtracted,
  emptyDraft,
  validateDraft,
  type DraftErrors,
  type ReceiptDraft,
} from '@/lib/reviewDraft';
import type { ScanJob } from '@/lib/scanQueue';

export default function ReviewScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const job = useScanJob(jobId);
  const c = usePalette();

  if (!job) {
    return (
      <View style={styles.center}>
        <Text>This receipt is no longer in the queue.</Text>
        <Button label="Back" onPress={() => router.back()} />
      </View>
    );
  }

  if (job.status !== 'ready' && job.status !== 'failed') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ color: c.muted }}>Reading the receipt with Gemini…</Text>
      </View>
    );
  }

  // Re-mount the form whenever Gemini produces a new answer (after Retry).
  return <ReviewForm key={job.extracted?.rawJson ?? `failed-${job.id}`} job={job} />;
}

function initialDraft(job: ScanJob, options: NormalizeOptions): ReceiptDraft {
  if (job.extracted) {
    return draftFromExtracted(
      normalizeReceipt(job.extracted.receipt, options),
      job.extracted.rawJson,
      randomUUID,
    );
  }
  // Gemini's answer was unusable: start from a blank scanned receipt, keep its raw text.
  return {
    ...emptyDraft('scanned', isoFromDate(new Date())),
    rawGeminiJson: job.error?.rawText ?? null,
  };
}

function ReviewForm({ job }: { job: ScanJob }) {
  const c = usePalette();
  const lists = useNormalizeOptions();
  const [draft, setDraftState] = useState(() => initialDraft(job, lists));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const setDraft = (update: (d: ReceiptDraft) => ReceiptDraft) => {
    setDraftState(update);
    setDirty(true);
  };

  function onSave() {
    const result = validateDraft(draft, lists);
    if (!result.ok) {
      setErrors(result.errors);
      setSaveError(`Fix ${Object.keys(result.errors).length} highlighted field(s) first.`);
      return;
    }
    setErrors({});
    const saved = saveReceipt(result.input, job.pages);
    if (!saved.ok) {
      setSaveError(saved.message);
      return;
    }
    removeJob(job.id); // also deletes the temporary compressed copies
    router.back();
  }

  function confirm(title: string, message: string, action: string, run: () => void) {
    if (!dirty) return run();
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: action, style: 'destructive', onPress: run },
    ]);
  }

  const onRetry = () =>
    confirm('Read again?', 'Your edits on this screen will be replaced.', 'Read again', () =>
      retryJob(job.id),
    );
  const onDiscard = () =>
    confirm('Discard receipt?', 'Nothing will be saved.', 'Discard', () => {
      removeJob(job.id);
      router.back();
    });

  const receipt = job.extracted?.receipt;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <Stack.Screen options={{ title: receipt ? `Review · ${receipt.store}` : 'Review receipt' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {job.pages.length > 0 && (
          <ScrollView horizontal contentContainerStyle={styles.pages}>
            {job.pages.map((p, i) => (
              <Image
                key={p.uri}
                source={{ uri: p.uri }}
                style={styles.page}
                resizeMode="contain"
                accessibilityLabel={`Receipt page ${i + 1}`}
              />
            ))}
          </ScrollView>
        )}

        {job.error && (
          <Banner tone="error">
            <Text style={{ color: c.error, fontWeight: '600' }}>{job.error.message}</Text>
            {job.error.issues?.slice(0, 5).map((issue) => (
              <Text key={issue} style={{ color: c.error, fontSize: 12 }}>
                • {issue}
              </Text>
            ))}
          </Banner>
        )}

        {receipt?.notes.length ? (
          <Banner tone="warn">{`Gemini notes: ${receipt.notes.join('; ')}`}</Banner>
        ) : null}

        <ReceiptForm draft={draft} setDraft={setDraft} errors={errors} />

        {saveError && <Banner tone="error">{saveError}</Banner>}

        <Button label="Save" onPress={onSave} style={styles.save} />
        <View style={[styles.row, { backgroundColor: 'transparent' }]}>
          <Button
            label="Retry with Gemini"
            kind="secondary"
            onPress={onRetry}
            style={styles.flex}
          />
          <Button label="Discard" kind="danger" onPress={onDiscard} style={styles.flex} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  pages: { gap: 8 },
  page: { width: 220, height: 300, borderRadius: 6, backgroundColor: '#888' },
  save: { minHeight: 52, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
