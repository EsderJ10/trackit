import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Text } from '@/ui';

import { authBackend } from './backend';
import { useAuthStore } from './auth-store';

export function SecuritySettings() {
  const router = useRouter();
  const lockEnabled = useAuthStore((state) => state.lockEnabled);
  const refreshLockEnabled = useAuthStore((state) => state.refreshLockEnabled);

  async function disable() {
    await authBackend.clearLock();
    await refreshLockEnabled();
  }

  return (
    <Card className="gap-3">
      <View>
        <Text variant="label">App lock</Text>
        <Text variant="muted" className="mt-1">
          {lockEnabled
            ? 'A PIN is required to open TrackIt.'
            : 'Require a PIN (and biometrics) to open TrackIt.'}
        </Text>
      </View>
      {lockEnabled ? (
        <View className="flex-row gap-3">
          <Button
            label="Change PIN"
            variant="secondary"
            size="md"
            className="flex-1"
            onPress={() => router.push('/set-pin')}
          />
          <Button
            label="Disable"
            variant="danger"
            size="md"
            className="flex-1"
            onPress={disable}
          />
        </View>
      ) : (
        <Button
          label="Enable app lock"
          size="md"
          onPress={() => router.push('/set-pin')}
        />
      )}
    </Card>
  );
}
