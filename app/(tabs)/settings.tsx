/**
 * Settings (SPEC §2.8, D76): a grouped list; each row opens its own page.
 * Receipt reading (Gemini), Lists (categories, store names), Data (photos, backup & export),
 * Developer (dev builds only), and the app version.
 */
import Constants from 'expo-constants';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { Text } from '@/components/Themed';
import { usePalette } from '@/components/ui';
import { getGeminiConfig } from '@/hooks/useGeminiSettings';
import { useCategories, useStoreAliases } from '@/hooks/useLists';
import { formatBytes, RETENTION_LABELS } from '@/lib/retention';
import { maskApiKey } from '@/lib/settings';
import { getRetention, photoStorageBytes } from '@/media/photoRetention';

type Summary = {
  gemini: { text: string; ok: boolean } | null;
  photos: string;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function SettingsScreen() {
  const c = usePalette();
  const categories = useCategories();
  const aliases = useStoreAliases();
  const [summary, setSummary] = useState<Summary>({ gemini: null, photos: '' });

  // Refresh the one-line summaries whenever Settings comes back into view.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const retention = getRetention();
      const photos = `${
        retention === 'never' ? 'Keep forever' : `Delete after ${RETENTION_LABELS[retention]}`
      } · ${formatBytes(photoStorageBytes())}`;
      setSummary((s) => ({ ...s, photos }));
      getGeminiConfig()
        .then((cfg) => {
          if (cancelled) return;
          setSummary((s) => ({
            ...s,
            gemini: cfg.apiKey
              ? { text: `Key ${maskApiKey(cfg.apiKey).slice(-6)} · ${cfg.model}`, ok: true }
              : { text: 'No API key — needed to scan receipts', ok: false },
          }));
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const open = (href: Href) => () => router.push(href);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SettingsGroup title="Receipt reading">
        <SettingsRow
          icon="auto_awesome"
          title="Gemini API key & model"
          subtitle={summary.gemini?.text ?? ' '}
          subtitleTone={summary.gemini && !summary.gemini.ok ? 'warn' : 'muted'}
          onPress={open('/settings/gemini')}
        />
      </SettingsGroup>

      <SettingsGroup title="Lists">
        <SettingsRow
          icon="category"
          title="Categories"
          subtitle={plural(categories.length, 'category', 'categories')}
          onPress={open('/settings/categories')}
        />
        <SettingsRow
          icon="storefront"
          title="Store names"
          subtitle={plural(aliases.length, 'store name')}
          onPress={open('/settings/stores')}
        />
      </SettingsGroup>

      <SettingsGroup title="Data">
        <SettingsRow
          icon="photo_library"
          title="Receipt photos"
          subtitle={summary.photos}
          onPress={open('/settings/photos')}
        />
        <SettingsRow
          icon="backup"
          title="Backup & export"
          subtitle="Excel export, backup and import"
          onPress={open('/settings/backup')}
        />
      </SettingsGroup>

      {__DEV__ && (
        <SettingsGroup title="Developer">
          <SettingsRow
            icon="code"
            title="Developer tools"
            subtitle="Sample data (development builds only)"
            onPress={open('/settings/developer')}
          />
        </SettingsGroup>
      )}

      <Text style={[styles.version, { color: c.muted }]}>
        Snap Spend {Constants.expoConfig?.version ?? ''}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 24 },
  version: { textAlign: 'center', fontSize: 12, marginTop: 8 },
});
