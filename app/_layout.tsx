import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import {
  GoogleSans_400Regular,
  GoogleSans_500Medium,
  GoogleSans_600SemiBold,
  GoogleSans_700Bold,
} from '@expo-google-fonts/google-sans';
import { GoogleSansCode_400Regular } from '@expo-google-fonts/google-sans-code';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';

import { useColorScheme } from '@/components/useColorScheme';
import { FONT } from '@/constants/fonts';

/** Navigation headers and tab labels in Google Sans (D58). */
const fonts = {
  regular: { fontFamily: FONT.regular, fontWeight: 'normal' },
  medium: { fontFamily: FONT.medium, fontWeight: 'normal' },
  bold: { fontFamily: FONT.bold, fontWeight: 'normal' },
  heavy: { fontFamily: FONT.bold, fontWeight: 'normal' },
} as const;
const darkTheme = { ...DarkTheme, fonts };
const lightTheme = { ...DefaultTheme, fonts };

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_600SemiBold,
    GoogleSans_700Bold,
    GoogleSansCode_400Regular,
  });
  // Brings the SQLite schema up to date before any screen reads from it.
  const migration = useMigrations(db, migrations);
  const ready = loaded && (migration.success || !!migration.error);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  if (migration.error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>Database update failed</Text>
        <Text selectable style={{ color: '#000' }}>
          {migration.error.message}
        </Text>
      </View>
    );
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? darkTheme : lightTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="review/[jobId]" options={{ title: 'Review receipt' }} />
          <Stack.Screen name="expense/new" options={{ title: 'Add expense' }} />
          <Stack.Screen name="item/[key]" options={{ title: 'Price history' }} />
          <Stack.Screen name="receipt/[id]" options={{ title: 'Receipt' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorBox: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#fff' },
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#000' },
});
