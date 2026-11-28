/** Settings (SPEC §2.8). Phase 3: Gemini API key, model name, "Test key". */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { ExternalLink } from '@/components/ExternalLink';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { useGeminiSettings } from '@/hooks/useGeminiSettings';
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
              <Button
                label="Remove"
                kind="danger"
                onPress={() => {
                  void s.removeKey();
                  setTest({ status: 'idle' });
                }}
              />
            </View>
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
      </ScrollView>
    </KeyboardAvoidingView>
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

type ButtonKind = 'primary' | 'secondary' | 'danger';

function Button({
  label,
  onPress,
  disabled,
  kind = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: ButtonKind;
}) {
  const c = usePalette();
  const bg = { primary: '#2f6fed', secondary: c.field, danger: '#c62828' }[kind];
  const fg = kind === 'secondary' ? c.text : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: c.border },
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

type Palette = ReturnType<typeof usePalette>;

function usePalette() {
  const dark = useColorScheme() === 'dark';
  return {
    text: dark ? '#fff' : '#000',
    muted: dark ? '#9a9a9a' : '#666',
    border: dark ? '#444' : '#ccc',
    field: dark ? '#1c1c1e' : '#f2f2f2',
    link: dark ? '#7aa7ff' : '#2f6fed',
    ok: dark ? '#66bb6a' : '#2e7d32',
    error: dark ? '#ef5350' : '#c62828',
  };
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 10 },
  heading: { fontSize: 17, fontWeight: '600' },
  section: { marginTop: 16 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 16 },
  masked: { fontFamily: 'SpaceMono', fontSize: 18, letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  hint: { fontSize: 13, lineHeight: 18 },
  button: {
    minHeight: 44,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dim: { opacity: 0.5 },
  buttonText: { fontWeight: '600', fontSize: 15 },
  resultBox: { gap: 4 },
  result: { fontSize: 15, fontWeight: '600' },
});
