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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { applyRetention } from '@/media/photoRetention';

import { ErrorScreen } from '@/components/ErrorScreen';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { FONT } from '@/constants/fonts';

/** Navigation headers and tab labels in Google Sans (D58). */
const fonts = {
  regular: { fontFamily: FONT.regular, fontWeight: 'normal' },
  medium: { fontFamily: FONT.medium, fontWeight: 'normal' },
  bold: { fontFamily: FONT.bold, fontWeight: 'normal' },
  heavy: { fontFamily: FONT.bold, fontWeight: 'normal' },
} as const;
// Screen backgrounds match the themed View background, so plain rows don't show as bands.
const darkTheme = {
  ...DarkTheme,
  fonts,
  colors: { ...DarkTheme.colors, background: Colors.dark.background },
};
const lightTheme = {
  ...DefaultTheme,
  fonts,
  colors: { ...DefaultTheme.colors, background: Colors.light.background },
};

/** Any screen that throws while rendering shows a themed error page with Try again (ErrorScreen). */
export { AppErrorBoundary as ErrorBoundary } from '@/components/ErrorScreen';

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
      <ErrorScreen
        title="Database update failed"
        message="Snap Spend could not update its database, so it can't open safely. Nothing was deleted. Restart the app; if this keeps happening, send this message to the developer."
        detail={migration.error.message}
      />
    );
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  // Photo retention (D74): once per launch, after the database is up to date. Never throws.
  useEffect(() => {
    applyRetention();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? darkTheme : lightTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="review/[jobId]" options={{ title: 'Review receipt' }} />
          <Stack.Screen name="expense/new" options={{ title: 'Add expense' }} />
          <Stack.Screen name="item/[key]" options={{ title: 'Price history' }} />
          <Stack.Screen name="receipt/[id]" options={{ title: 'Receipt' }} />
          <Stack.Screen name="settings/categories" options={{ title: 'Categories' }} />
          <Stack.Screen name="settings/stores" options={{ title: 'Store names' }} />
          <Stack.Screen name="settings/gemini" options={{ title: 'Gemini' }} />
          <Stack.Screen name="settings/photos" options={{ title: 'Receipt photos' }} />
          <Stack.Screen name="settings/backup" options={{ title: 'Backup & export' }} />
          <Stack.Screen name="settings/developer" options={{ title: 'Developer tools' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
