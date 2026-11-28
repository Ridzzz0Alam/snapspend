/** Form building blocks shared by the Review screen and the manual expense form. */
import type { ReactNode } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text, View } from './Themed';
import { usePalette } from './ui';

export function Field({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
  style,
  small,
  autoCapitalize = 'sentences',
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const c = usePalette();
  return (
    <View style={[styles.field, { backgroundColor: 'transparent' }, style]}>
      {label ? <Text style={[styles.label, { color: c.muted }]}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label ?? placeholder}
        style={[
          styles.input,
          small && styles.inputSmall,
          {
            color: c.text,
            backgroundColor: c.field,
            borderColor: error ? c.error : c.border,
          },
        ]}
      />
      {error ? <Text style={[styles.error, { color: c.error }]}>{error}</Text> : null}
    </View>
  );
}

export type Tone = 'ok' | 'warn' | 'error';

export function Banner({ tone, children }: { tone: Tone; children: ReactNode }) {
  const c = usePalette();
  const fg = { ok: c.ok, warn: c.warn, error: c.error }[tone];
  const bg = { ok: c.okBg, warn: c.warnBg, error: c.errorBg }[tone];
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: bg, borderColor: fg }]}
    >
      {typeof children === 'string' ? <Text style={{ color: fg }}>{children}</Text> : children}
    </View>
  );
}

/** Row of mutually exclusive options (≥ 44dp tall). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  const c = usePalette();
  return (
    <View style={[styles.segmented, { borderColor: c.border }]}>
      {options.map((o) => {
        const selected = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o)}
            style={[styles.segment, { backgroundColor: selected ? c.primary : c.field }]}
          >
            <Text style={{ color: selected ? '#fff' : c.text, fontWeight: '600' }}>
              {labels?.[o] ?? o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A button showing the current choice; opens a full list to pick from. */
export function Picker({
  label,
  value,
  options,
  onChange,
  visible,
  setVisible,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  visible: boolean;
  setVisible: (v: boolean) => void;
}) {
  const c = usePalette();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}. Change`}
        onPress={() => setVisible(true)}
        style={[styles.pickerButton, { backgroundColor: c.field, borderColor: c.border }]}
      >
        <Text numberOfLines={1}>{value} ▾</Text>
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: item === value }}
                  onPress={() => {
                    onChange(item);
                    setVisible(false);
                  }}
                  style={styles.option}
                >
                  <Text style={item === value ? { color: c.link, fontWeight: '700' } : undefined}>
                    {item}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontSize: 13 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 16 },
  inputSmall: { minHeight: 44, fontSize: 15, paddingHorizontal: 8 },
  error: { fontSize: 12 },
  banner: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 4 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pickerButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 12, borderWidth: 1, maxHeight: '80%', paddingVertical: 8 },
  sheetTitle: { fontSize: 17, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 8 },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
});
