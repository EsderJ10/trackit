import { Stack } from 'expo-router';

import { moduleStackScreenOptions } from '@/ui';

export default function ModuleLayout() {
  return <Stack screenOptions={moduleStackScreenOptions} />;
}
