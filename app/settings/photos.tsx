/** Settings → Receipt photos: delete photos older than Never / 6 months / 1 year (D46, D74). */
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { Banner } from '@/components/form';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { useReceiptsVersion } from '@/hooks/useReceiptsVersion';
import { formatLogDate } from '@/lib/format';
import {
  formatBytes,
  isStricter,
  RETENTION_LABELS,
  RETENTION_OPTIONS,
  type Retention,
} from '@/lib/retention';
import {
  applyRetention,
  getRetention,
  photoStorageBytes,
  previewRetention,
  setRetention,
} from '@/media/photoRetention';

const receiptsText = (n: number) => `${n} receipt${n === 1 ? '' : 's'}`;

const SUBTITLES: Record<Retention, string> = {
  never: 'Keep every photo',
  '6m': 'Delete photos of receipts older than 6 months',
  '1y': 'Delete photos of receipts older than 1 year',
};

export default function PhotoSettingsScreen() {
  const version = useReceiptsVersion();
  const [option, setOption] = useState<Retention>(getRetention);
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const bytes = useMemo(() => {
    void version;
    void tick;
    return photoStorageBytes();
  }, [version, tick]);

  function commit(to: Retention) {
    setRetention(to);
    setOption(to);
    const n = applyRetention(to);
    setTick((t) => t + 1);
    setMessage(n ? `Deleted the photos of ${receiptsText(n)}.` : null);
  }

  function choose(to: Retention) {
    if (to === option) return;
    setMessage(null);
    if (!isStricter(option, to)) return commit(to);
    const preview = previewRetention(to);
    if (preview.receipts === 0) return commit(to);
    Alert.alert(
      'Delete old photos?',
      `The photos of ${receiptsText(preview.receipts)} dated before ${formatLogDate(
        preview.cutoff!,
      )} (${formatBytes(preview.bytes)}) will be deleted now, and older photos from then on. The receipts, items and totals stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete photos', style: 'destructive', onPress: () => commit(to) },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SettingsGroup title="Storage">
        <SettingsRow
          icon="photo_library"
          title={formatBytes(bytes)}
          subtitle="Used by receipt photos on this phone"
        />
      </SettingsGroup>

      <SettingsGroup
        plain
        title="Delete old photos"
        footer="Age is by the receipt's date. Only photos are deleted; receipts, items and totals are always kept. Photos are not in the backup."
      >
        {RETENTION_OPTIONS.map((o) => (
          <SettingsRow
            key={o}
            title={RETENTION_LABELS[o]}
            subtitle={SUBTITLES[o]}
            selected={o === option}
            onPress={() => choose(o)}
          />
        ))}
      </SettingsGroup>

      {message && <Banner tone="ok">{message}</Banner>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 24 },
});
