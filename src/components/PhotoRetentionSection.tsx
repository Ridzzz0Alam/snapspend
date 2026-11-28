/** Settings → Receipt photos: "Delete receipt images older than" Never / 6 months / 1 year (D46, D74). */
import { useMemo, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

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

import { Banner, Segmented } from './form';
import { Text, View } from './Themed';
import { usePalette } from './ui';

const receiptsText = (n: number) => `${n} receipt${n === 1 ? '' : 's'}`;

export function PhotoRetentionSection() {
  const c = usePalette();
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

  function onChange(to: Retention) {
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
    <View style={[styles.section, { borderColor: c.border }]}>
      <Text style={styles.title}>Receipt photos</Text>
      <Text style={[styles.hint, { color: c.muted }]}>Delete photos older than</Text>
      <Segmented
        options={RETENTION_OPTIONS}
        value={option}
        onChange={onChange}
        labels={RETENTION_LABELS}
      />
      <Text style={[styles.hint, { color: c.muted }]}>
        Photos use {formatBytes(bytes)} on this phone. Only the photos are deleted; receipts and
        items are always kept. Photos are not in the backup.
      </Text>
      {message && <Banner tone="ok">{message}</Banner>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  title: { fontSize: 17, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 17 },
});
