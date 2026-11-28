/** Settings → Backup & export: Excel export, JSON backup, JSON import with merge (D71, D72). */
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { Banner } from '@/components/form';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { exportBackup, exportExcel, importBackup, type FileResult } from '@/media/exportFiles';

type Busy = null | 'excel' | 'backup' | 'import';

export default function BackupSettingsScreen() {
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
    <ScrollView contentContainerStyle={styles.container}>
      <SettingsGroup
        title="Export"
        footer="An .xlsx file with an Items sheet and a Receipts sheet. Opens in Google Sheets or Excel."
      >
        <SettingsRow
          icon="table_chart"
          title="Export to Excel"
          subtitle="Share or save a spreadsheet"
          chevron={false}
          busy={busy === 'excel'}
          disabled={busy !== null && busy !== 'excel'}
          onPress={() => run('excel', exportExcel)}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Backup"
        footer="The backup holds all receipts, items, categories and store names (not the photos). Save it to Google Drive or your files; import it on this or another phone to merge."
      >
        <SettingsRow
          icon="backup"
          title="Back up now"
          subtitle="Save a JSON backup file"
          chevron={false}
          busy={busy === 'backup'}
          disabled={busy !== null && busy !== 'backup'}
          onPress={() => run('backup', exportBackup)}
        />
        <SettingsRow
          icon="restore"
          title="Import backup"
          subtitle="Merge a backup file into this phone"
          chevron={false}
          busy={busy === 'import'}
          disabled={busy !== null && busy !== 'import'}
          onPress={confirmImport}
        />
      </SettingsGroup>

      {result && <Banner tone={result.ok ? 'ok' : 'error'}>{result.message}</Banner>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 24 },
});
