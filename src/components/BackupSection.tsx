/** Settings → Backup & export: Excel export, JSON backup, JSON import (merge). */
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';

import { exportBackup, exportExcel, importBackup, type FileResult } from '@/media/exportFiles';

import { Banner } from './form';
import { Text, View } from './Themed';
import { Button, usePalette } from './ui';

type Busy = null | 'excel' | 'backup' | 'import';

export function BackupSection() {
  const c = usePalette();
  const [busy, setBusy] = useState<Busy>(null);
  const [result, setResult] = useState<FileResult | null>(null);

  async function run(kind: Exclude<Busy, null>, task: () => Promise<FileResult | null>) {
    setBusy(kind);
    setResult(null);
    try {
      const r = await task();
      if (r) setResult(r);
    } finally {
      setBusy(null);
    }
  }

  function confirmImport() {
    Alert.alert(
      'Import a backup?',
      'Receipts in the file are merged with the ones on this phone: new ones are added, and a receipt is replaced only if the file has a newer version. Nothing on this phone is deleted unless it was deleted in the backup.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Choose file', onPress: () => run('import', importBackup) },
      ],
    );
  }

  return (
    <View style={[styles.section, { borderColor: c.border, backgroundColor: 'transparent' }]}>
      <Text style={styles.title}>Backup & export</Text>

      <Button
        label={busy === 'excel' ? 'Preparing Excel file…' : 'Export to Excel'}
        onPress={() => run('excel', exportExcel)}
        disabled={busy !== null}
      />
      <Text style={[styles.hint, { color: c.muted }]}>
        An .xlsx file with an Items sheet and a Receipts sheet. Opens in Google Sheets or Excel.
      </Text>

      <View style={[styles.row, { backgroundColor: 'transparent' }]}>
        <Button
          label={busy === 'backup' ? 'Saving…' : 'Back up (JSON)'}
          kind="secondary"
          onPress={() => run('backup', exportBackup)}
          disabled={busy !== null}
          style={styles.flex}
        />
        <Button
          label={busy === 'import' ? 'Importing…' : 'Import backup'}
          kind="secondary"
          onPress={confirmImport}
          disabled={busy !== null}
          style={styles.flex}
        />
      </View>
      <Text style={[styles.hint, { color: c.muted }]}>
        The backup holds all receipts, items and store aliases (not the photos). Save it to Google
        Drive or your files; import it on this or another phone to merge.
      </Text>

      {busy && <ActivityIndicator />}
      {result && <Banner tone={result.ok ? 'ok' : 'error'}>{result.message}</Banner>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  title: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  hint: { fontSize: 12, lineHeight: 17 },
});
