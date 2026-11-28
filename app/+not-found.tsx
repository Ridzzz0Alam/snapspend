/** Unknown route (e.g. a stale deep link): themed message with a way back to Home. */
import { router, Stack } from 'expo-router';

import { ErrorScreen } from '@/components/ErrorScreen';
import { Button } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <ErrorScreen
        title="This page doesn't exist"
        message="The link may be out of date. Your receipts are not affected."
        actions={<Button label="Go to Home" onPress={() => router.replace('/')} />}
      />
    </>
  );
}
