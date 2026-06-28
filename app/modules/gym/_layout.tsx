import { Stack } from 'expo-router';

import { moduleStackScreenOptions } from '@/ui';

export default function GymLayout() {
  return (
    <Stack screenOptions={moduleStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Gym' }} />
    </Stack>
  );
}
