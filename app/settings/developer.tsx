/** Settings → Developer (dev builds only, D42): receipt count and sample data. */
import { ScrollView, StyleSheet } from 'react-native';

import { DevDataPanel } from '@/components/DevDataPanel';

export default function DeveloperSettingsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <DevDataPanel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
});
