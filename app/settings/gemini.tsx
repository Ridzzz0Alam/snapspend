/**
 * Settings → Gemini (SPEC §2.8, D49, D76): API key (secure store, masked), model name, Test key.
 * The full key never enters React state; only its masked form is shown.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { ExternalLink } from '@/components/ExternalLink';
import { Banner } from '@/components/form';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { Text, View } from '@/components/Themed';
import { Button, usePalette } from '@/components/ui';
import { FONT } from '@/constants/fonts';
import { useGeminiSettings } from '@/hooks/useGeminiSettings';
import { DEFAULT_GEMINI_MODEL, type GeminiResult } from '@/lib/gemini';

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'done'; result: GeminiResult<{ model: string }> };

export default function GeminiSettingsScreen() {
  const settings = useGeminiSettings();
  if (settings.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  return <GeminiForm s={settings} />;
}

/** Mounted only after settings have loaded, so the inputs start from the saved values. */
function GeminiForm({ s }: { s: ReturnType<typeof useGeminiSettings> }) {
  const c = usePalette();
  const [editingKey, setEditingKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [modelInput, setModelInput] = useState(s.model);
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  const showKeyInput = !s.hasKey || editingKey;
  const inputStyle = [
    styles.input,
    { color: c.text, borderColor: c.border, backgroundColor: c.field },
  ];

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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <SettingsGroup
          title="API key"
          footer={
            <Text style={[styles.footer, { color: c.muted }]}>
              Stored encrypted on this phone only. Get a free key at{' '}
              <ExternalLink href="https://aistudio.google.com/apikey" style={{ color: c.link }}>
                aistudio.google.com/apikey
              </ExternalLink>
            </Text>
          }
        >
          {s.hasKey && (
            <SettingsRow
              icon="vpn_key"
              title={s.maskedKey}
              subtitle={
                s.keySource === 'env'
                  ? 'From the .env file (development builds only). A key saved here takes priority.'
                  : 'Saved on this phone'
              }
            />
          )}
          {s.hasKey && !editingKey && (
            <SettingsRow
              icon="edit"
              title="Replace key"
              chevron={false}
              onPress={() => setEditingKey(true)}
            />
          )}
          {s.hasKey && !editingKey && s.keySource === 'settings' && (
            <SettingsRow
              icon="delete"
              title="Remove key"
              danger
              chevron={false}
              onPress={() => {
                void s.removeKey();
                setTest({ status: 'idle' });
              }}
            />
          )}
          {showKeyInput && (
            <View style={styles.pad}>
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
              <View style={styles.buttons}>
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
            </View>
          )}
        </SettingsGroup>

        <SettingsGroup title="Model" footer={`Default: ${DEFAULT_GEMINI_MODEL}`}>
          <View style={styles.pad}>
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
            {(modelInput.trim() !== s.model || s.model !== DEFAULT_GEMINI_MODEL) && (
              <View style={styles.buttons}>
                {modelInput.trim() !== s.model && (
                  <Button label="Save model" onPress={onSaveModel} />
                )}
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
            )}
          </View>
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow
            icon="check_circle"
            title="Test key"
            subtitle={`Sends a tiny request to ${s.model}`}
            chevron={false}
            busy={test.status === 'testing'}
            disabled={!s.hasKey}
            onPress={onTest}
          />
        </SettingsGroup>
        {test.status === 'done' && <TestResult result={test.result} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TestResult({ result }: { result: GeminiResult<{ model: string }> }) {
  const c = usePalette();
  if (result.ok) {
    return <Banner tone="ok">{`✓ Key works with ${result.value.model}.`}</Banner>;
  }
  return (
    <Banner tone="error">
      <Text style={{ color: c.error, fontWeight: '600' }}>✗ {result.error.message}</Text>
      {result.error.detail ? (
        <Text style={[styles.detail, { color: c.muted }]} selectable>
          {result.error.status ? `HTTP ${result.error.status}: ` : ''}
          {result.error.detail}
        </Text>
      ) : null}
    </Banner>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 24 },
  pad: { padding: 16, gap: 12, backgroundColor: 'transparent' },
  buttons: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', backgroundColor: 'transparent' },
  footer: { fontSize: 12, lineHeight: 17, marginHorizontal: 16 },
  detail: { fontSize: 12, lineHeight: 17 },
  input: {
    fontFamily: FONT.regular,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
});
