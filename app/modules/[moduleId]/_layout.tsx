import { Stack } from 'expo-router';

import { colors } from '@/ui';

export default function ModuleLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.fg,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
