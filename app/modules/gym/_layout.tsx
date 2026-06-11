import { Stack } from 'expo-router';

import { colors } from '@/ui';

export default function GymLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.fg,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Gym' }} />
    </Stack>
  );
}
