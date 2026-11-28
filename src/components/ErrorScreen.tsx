/**
 * Full-screen error state: the app-wide error boundary (a screen threw while rendering, e.g. a
 * database read failed) and the "Database update failed" screen. Themed, shows the message so
 * it can be reported, and offers a way out instead of a blank or raw error page.
 */
import { router, type ErrorBoundaryProps } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { Text, View } from './Themed';
import { Button, usePalette } from './ui';

export function ErrorScreen({
  title,
  message,
  detail,
  actions,
}: {
  title: string;
  message: string;
  detail?: string;
  actions?: React.ReactNode;
}) {
  const c = usePalette();
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.icon, { color: c.error }]} accessibilityElementsHidden>
          ⚠
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[styles.message, { color: c.muted }]}>{message}</Text>
        {detail ? (
          <Text
            selectable
            style={[
              styles.detail,
              { color: c.text, backgroundColor: c.field, borderColor: c.border },
            ]}
          >
            {detail}
          </Text>
        ) : null}
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </ScrollView>
    </View>
  );
}

/** Expo Router error boundary: exported from app/_layout.tsx so every screen gets it. */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ErrorScreen
      title="Something went wrong"
      message="This screen hit an error. Your saved receipts are not affected. Try again, or go back to Home."
      detail={error.message}
      actions={
        <>
          <Button label="Try again" onPress={() => void retry()} />
          <Button
            label="Go to Home"
            kind="secondary"
            onPress={() => {
              router.replace('/');
              void retry();
            }}
          />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  icon: { fontSize: 40, textAlign: 'center' },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  detail: {
    fontSize: 13,
    lineHeight: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
  },
  actions: { gap: 10, marginTop: 8, backgroundColor: 'transparent' },
});
