/** Small shared UI pieces: theme palette and a 44dp+ button (SPEC §7 accessibility). */
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Themed';
import { useColorScheme } from './useColorScheme';

export type Palette = ReturnType<typeof usePalette>;

export function usePalette() {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    text: dark ? '#fff' : '#000',
    muted: dark ? '#9a9a9a' : '#666',
    border: dark ? '#444' : '#ccc',
    field: dark ? '#1c1c1e' : '#f2f2f2',
    card: dark ? '#141416' : '#fafafa',
    link: dark ? '#7aa7ff' : '#2f6fed',
    primary: '#2f6fed',
    ok: dark ? '#66bb6a' : '#2e7d32',
    okBg: dark ? '#1b2e1c' : '#e8f5e9',
    warn: dark ? '#ffb74d' : '#a15c00',
    warnBg: dark ? '#33270f' : '#fff4e0',
    error: dark ? '#ef5350' : '#c62828',
    errorBg: dark ? '#3a1717' : '#fdecea',
  };
}

export type ButtonKind = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  onPress,
  disabled,
  kind = 'primary',
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: ButtonKind;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const c = usePalette();
  const bg = { primary: c.primary, secondary: c.field, danger: '#c62828' }[kind];
  const fg = kind === 'secondary' ? c.text : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: c.border },
        (pressed || disabled) && styles.dim,
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A compact 44dp-tall symbol button (↑ ↓ ✎ ✕) for list rows; always give it a spoken label. */
export function IconButton({
  label,
  accessibilityLabel,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.icon, (pressed || disabled) && styles.faint]}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: danger ? c.error : c.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dim: { opacity: 0.5 },
  faint: { opacity: 0.3 },
  icon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: '600', fontSize: 15 },
});
