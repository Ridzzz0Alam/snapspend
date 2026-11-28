/**
 * Settings (SPEC §2.8): Gemini API key, model name and "Test key"; links to the category and
 * store-name editors (D73); backup & export.
 */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { BackupSection } from '@/components/BackupSection';
import { DevDataPanel } from '@/components/DevDataPanel';
import { ExternalLink } from '@/components/ExternalLink';
import { Text, View } from '@/components/Themed';
import { Button, usePalette, type Palette } from '@/components/ui';
import { FONT, MONO_FONT } from '@/constants/fonts';
import { useGeminiSettings } from '@/hooks/useGeminiSettings';
import { useCategories, useStoreAliases } from '@/hooks/useLists';
import { DEFAULT_GEMINI_MODEL, type GeminiResult } from '@/lib/gemini';

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'done'; result: GeminiResult<{ model: string }> };

export default function SettingsScreen() {
  const settings = useGeminiSettings();
  if (settings.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  return <SettingsForm s={settings} />;
}

/** Mounted only after settings have loaded, so the inputs start from the saved values. */
function SettingsForm({ s }: { s: ReturnType<typeof useGeminiSettings> }) {
  const c = usePalette();

  const [editingKey, setEditingKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [modelInput, setModelInput] = useState(s.model);
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  const showKeyInput = !s.hasKey || editingKey;

  async function onSaveKey() {
    if (await s.saveKey(keyInput)) {
      setKeyInput('');
      setEditingKey(false);
      setTest({ status: 'idle' });
    }
  }

  async function onTest() {
    setTest({ status: 'testing' });
    setTest({ status: 'done', result: await s.testKey() });
  }

  function onSaveModel() {
    setModelInput(s.saveModel(modelInput));
    setTest({ status: 'idle' });
  }

  const inputStyle = [
    styles.input,
    { color: c.text, borderColor: c.border, backgroundColor: c.field },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Gemini API key</Text>
        {showKeyInput ? (
          <>
            <TextInput
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="Paste your Gemini API key"
              placeholderTextColor={c.muted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              importantForAutofill="no"
              accessibilityLabel="Gemini API key"
              style={inputStyle}
            />
            <View style={styles.row}>
              <Button label="Save key" onPress={onSaveKey} disabled={!keyInput.trim()} />
              {s.hasKey && (
                <Button
                  label="Cancel"
                  kind="secondary"
                  onPress={() => {
                    setEditingKey(false);
                    setKeyInput('');
                  }}
                />
              )}
            </View>
            <Text style={[styles.hint, { color: c.muted }]}>
              Stored encrypted on this phone only. Get a key at{' '}
              <ExternalLink href="https://aistudio.google.com/apikey" style={{ color: c.link }}>
                aistudio.google.com/apikey
              </ExternalLink>
            </Text>
          </>
        ) : (
          <>
            <Text
              style={styles.masked}
              accessibilityLabel={`Saved API key ending in ${s.maskedKey.slice(-4)}`}
            >
              {s.maskedKey}
            </Text>
            <View style={styles.row}>
              <Button label="Replace" kind="secondary" onPress={() => setEditingKey(true)} />
              {s.keySource === 'settings' && (
                <Button
                  label="Remove"
                  kind="danger"
                  onPress={() => {
                    void s.removeKey();
                    setTest({ status: 'idle' });
                  }}
                />
              )}
            </View>
            {s.keySource === 'env' && (
              <Text style={[styles.hint, { color: c.muted }]}>
                From the .env file on the computer (development builds only). A key saved here takes
                priority.
              </Text>
            )}
          </>
        )}

        <Text style={[styles.heading, styles.section]}>Model</Text>
        <TextInput
          value={modelInput}
          onChangeText={setModelInput}
          onSubmitEditing={onSaveModel}
          onBlur={onSaveModel}
          placeholder={DEFAULT_GEMINI_MODEL}
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Gemini model name"
          style={inputStyle}
        />
        <View style={styles.row}>
          {modelInput.trim() !== s.model && <Button label="Save model" onPress={onSaveModel} />}
          {s.model !== DEFAULT_GEMINI_MODEL && (
            <Button
              label="Use default"
              kind="secondary"
              onPress={() => {
                setModelInput(s.saveModel(DEFAULT_GEMINI_MODEL));
                setTest({ status: 'idle' });
              }}
            />
          )}
        </View>
        <Text style={[styles.hint, { color: c.muted }]}>Default: {DEFAULT_GEMINI_MODEL}</Text>

        <View style={[styles.row, styles.section]}>
          <Button
            label={test.status === 'testing' ? 'Testing…' : 'Test key'}
            onPress={onTest}
            disabled={!s.hasKey || test.status === 'testing'}
          />
        </View>
        {test.status === 'done' && <TestResult result={test.result} palette={c} />}

        <ListsSection />

        <BackupSection />

        {__DEV__ && <DevDataPanel />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Settings → Lists: rows that open the category and store-name editors. */
function ListsSection() {
  const c = usePalette();
  const categories = useCategories();
  const aliases = useStoreAliases();
  return (
    <View style={[styles.lists, { borderColor: c.border }]}>
      <Text style={styles.heading}>Lists</Text>
      <LinkRow
        title="Categories"
        detail={`${categories.length} categories`}
        href="/settings/categories"
      />
      <LinkRow
        title="Store names"
        detail={`${aliases.length} printed name${aliases.length === 1 ? '' : 's'} renamed`}
        href="/settings/stores"
      />
    </View>
  );
}

function LinkRow({ title, detail, href }: { title: string; detail: string; href: Href }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}. Open`}
      onPress={() => router.push(href)}
      style={({ pressed }) => [
        styles.link,
        { backgroundColor: c.field, borderColor: c.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={styles.linkText}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={[styles.hint, { color: c.muted }]}>{detail}</Text>
      </View>
      <Text style={[styles.linkTitle, { color: c.muted }]}>›</Text>
    </Pressable>
  );
}

function TestResult({
  result,
  palette: c,
}: {
  result: GeminiResult<{ model: string }>;
  palette: Palette;
}) {
  if (result.ok) {
    return (
      <Text accessibilityLiveRegion="polite" style={[styles.result, { color: c.ok }]}>
        ✓ Key works with {result.value.model}.
      </Text>
    );
  }
  return (
    <View style={styles.resultBox}>
      <Text accessibilityLiveRegion="polite" style={[styles.result, { color: c.error }]}>
        ✗ {result.error.message}
      </Text>
      {result.error.detail ? (
        <Text style={[styles.hint, { color: c.muted }]} selectable>
          {result.error.status ? `HTTP ${result.error.status}: ` : ''}
          {result.error.detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 10 },
  heading: { fontSize: 17, fontWeight: '600' },
  section: { marginTop: 16 },
  input: {
    fontFamily: FONT.regular,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  masked: { fontFamily: MONO_FONT, fontSize: 18, letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  hint: { fontSize: 13, lineHeight: 18 },
  resultBox: { gap: 4 },
  lists: { marginTop: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  link: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  linkText: { flex: 1, backgroundColor: 'transparent' },
  linkTitle: { fontSize: 16, fontWeight: '600' },
  result: { fontSize: 15, fontWeight: '600' },
});
