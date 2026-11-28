/**
 * Settings building blocks (D76): grouped rounded cards of rows, like Android's own Settings.
 * A row has a tinted icon, a title, an optional one-line summary, and a chevron when it opens a
 * page. Used by the Settings tab and its sub-pages.
 */
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text, View } from './Themed';
import { usePalette } from './ui';

/** Android Material symbol names (see expo-symbols' symbols.json). */
export type IconName = string;

export function SettingsGroup({
  title,
  footer,
  plain,
  children,
}: {
  title?: string;
  footer?: ReactNode;
  /** Rows without icons: dividers start at the text edge instead of after the icon. */
  plain?: boolean;
  children: ReactNode;
}) {
  const c = usePalette();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      {title ? (
        <Text style={[styles.groupTitle, { color: c.primary }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 && (
              <View
                style={[
                  styles.divider,
                  plain && styles.plainDivider,
                  { backgroundColor: c.border },
                ]}
              />
            )}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        typeof footer === 'string' ? (
          <Text style={[styles.footer, { color: c.muted }]}>{footer}</Text>
        ) : (
          footer
        )
      ) : null}
    </View>
  );
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  subtitleTone,
  onPress,
  chevron = !!onPress,
  busy,
  disabled,
  selected,
  danger,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  subtitleTone?: 'muted' | 'warn' | 'ok';
  onPress?: () => void;
  /** Shows › (opens a page). Defaults to true when the row is tappable. */
  chevron?: boolean;
  busy?: boolean;
  disabled?: boolean;
  /** Radio-style choice rows: shows ✓ instead of a chevron. */
  selected?: boolean;
  danger?: boolean;
}) {
  const c = usePalette();
  const subColor = { muted: c.muted, warn: c.warn, ok: c.ok }[subtitleTone ?? 'muted'];
  const tint = danger ? c.error : c.primary;
  const radio = selected !== undefined;
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={{
        disabled: !!(disabled || busy),
        selected: radio ? selected : undefined,
      }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      disabled={!onPress || disabled || busy}
      onPress={onPress}
      android_ripple={{ color: c.border }}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: c.field },
        disabled && styles.dim,
      ]}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: c.dark ? '#1d2a44' : '#e6eefd' }]}>
          <SymbolView
            name={{ android: icon, ios: icon as SFSymbol, web: icon } as never}
            tintColor={tint}
            size={22}
          />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.title, danger && { color: c.error }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: subColor }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator />
      ) : radio ? (
        <Text style={[styles.check, { color: c.primary, opacity: selected ? 1 : 0 }]}>✓</Text>
      ) : chevron ? (
        <SymbolView
          name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' } as never}
          tintColor={c.muted}
          size={22}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8, backgroundColor: 'transparent' },
  groupTitle: { fontSize: 13, fontWeight: '600', marginLeft: 16, letterSpacing: 0.3 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  plainDivider: { marginLeft: 16 },
  footer: { fontSize: 12, lineHeight: 17, marginHorizontal: 16 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 16,
  },
  dim: { opacity: 0.5 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2, backgroundColor: 'transparent' },
  title: { fontSize: 16 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  check: { fontSize: 18, fontWeight: '700' },
});
