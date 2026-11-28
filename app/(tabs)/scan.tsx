/**
 * Scan tab (SPEC §2.2): ML Kit document scanner (multi-page), gallery import (multi-select = batch),
 * and the queue of receipts being compressed / read by Gemini.
 */
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';

import { Text, View } from '@/components/Themed';
import { Button, usePalette } from '@/components/ui';
import { enqueueReceipts, removeJob, retryJob, useScanQueue } from '@/hooks/useScanQueue';
import { formatFt } from '@/lib/money';
import type { ScanJob } from '@/lib/scanQueue';
import { toFileUri } from '@/media/receiptImages';

const MAX_PAGES = 10;
const MAX_GALLERY = 20;

export default function ScanScreen() {
  const { jobs } = useScanQueue();
  const c = usePalette();
  const [message, setMessage] = useState<string | null>(null);

  async function scan() {
    setMessage(null);
    try {
      const res = await DocumentScanner.scanDocument({
        maxNumDocuments: MAX_PAGES,
        croppedImageQuality: 100,
        responseType: ResponseType.ImageFilePath,
      });
      if (res.status !== ScanDocumentResponseStatus.Success || !res.scannedImages?.length) return;
      enqueueReceipts([res.scannedImages.map(toFileUri)], 'scanner');
    } catch (e) {
      // e.g. Google Play services missing or outdated (D12).
      setMessage(
        `The document scanner couldn't start. Use "Import from gallery" instead.${
          e instanceof Error ? `\n(${e.message})` : ''
        }`,
      );
    }
  }

  async function importFromGallery() {
    setMessage(null);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_GALLERY,
      quality: 1,
      exif: false,
    });
    if (res.canceled || !res.assets.length) return;
    // Batch mode: each selected photo is its own receipt.
    enqueueReceipts(
      res.assets.map((a) => [a.uri]),
      'gallery',
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button label="Scan receipt" onPress={scan} style={styles.big} />
      <View style={styles.row}>
        <Button
          label="Import from gallery"
          kind="secondary"
          onPress={importFromGallery}
          style={styles.flex}
        />
        <Button
          label="Add expense"
          kind="secondary"
          onPress={() => router.push('/expense/new')}
          style={styles.flex}
        />
      </View>
      <Text style={[styles.hint, { color: c.muted }]}>
        Long receipt? Add several pages in one scan. Several receipts? Pick them all from the
        gallery — each photo becomes its own receipt.
      </Text>
      {message && <Text style={[styles.hint, { color: c.error }]}>{message}</Text>}

      {jobs.length > 0 && <Text style={styles.heading}>Queue</Text>}
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </ScrollView>
  );
}

const STATUS_TEXT: Record<ScanJob['status'], string> = {
  queued: 'Waiting…',
  compressing: 'Preparing image…',
  compressed: 'Waiting for Gemini…',
  reading: 'Reading with Gemini…',
  ready: 'Ready to review',
  failed: 'Failed',
};

function JobRow({ job }: { job: ScanJob }) {
  const c = usePalette();
  const thumb = job.pages[0]?.uri ?? job.originalUris[0];
  const busy = job.status !== 'ready' && job.status !== 'failed';
  const receipt = job.extracted?.receipt;
  const canOpen = job.status === 'ready' || job.error?.kind === 'invalid_receipt';
  const pagesLabel = job.originalUris.length > 1 ? ` · ${job.originalUris.length} pages` : '';

  const open = () => router.push({ pathname: '/review/[jobId]', params: { jobId: job.id } });

  return (
    <View style={[styles.job, { borderColor: c.border, backgroundColor: c.card }]}>
      <Pressable
        onPress={canOpen ? open : undefined}
        disabled={!canOpen}
        accessibilityRole="button"
        accessibilityLabel={canOpen ? 'Open review' : undefined}
        style={[styles.jobMain, { backgroundColor: 'transparent' }]}
      >
        {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} /> : null}
        <View style={[styles.jobText, { backgroundColor: 'transparent' }]}>
          {receipt ? (
            <Text style={styles.jobTitle} numberOfLines={1}>
              {receipt.store} · {formatFt(receipt.printedTotal)}
            </Text>
          ) : (
            <Text style={styles.jobTitle}>
              {job.source === 'scanner' ? 'Scanned receipt' : 'Gallery photo'}
              {pagesLabel}
            </Text>
          )}
          <View style={[styles.statusRow, { backgroundColor: 'transparent' }]}>
            {busy && <ActivityIndicator size="small" />}
            <Text
              style={{
                color: job.status === 'failed' ? c.error : job.status === 'ready' ? c.ok : c.muted,
              }}
            >
              {job.status === 'failed' && job.error ? job.error.message : STATUS_TEXT[job.status]}
            </Text>
          </View>
        </View>
      </Pressable>
      <View style={[styles.row, { backgroundColor: 'transparent' }]}>
        {job.status === 'ready' && <Button label="Review" onPress={open} />}
        {job.status === 'failed' && <Button label="Retry" onPress={() => retryJob(job.id)} />}
        {job.error?.kind === 'invalid_receipt' && (
          <Button label="Edit by hand" kind="secondary" onPress={open} />
        )}
        <Button
          label={busy ? 'Cancel' : 'Discard'}
          kind="secondary"
          onPress={() => removeJob(job.id)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  big: { minHeight: 64 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  flex: { flex: 1 },
  hint: { fontSize: 13, lineHeight: 18 },
  heading: { fontSize: 17, fontWeight: '600', marginTop: 12 },
  job: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  jobMain: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 48, height: 64, borderRadius: 4, backgroundColor: '#888' },
  jobText: { flex: 1, gap: 4 },
  jobTitle: { fontSize: 16, fontWeight: '600' },
  statusRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
});
