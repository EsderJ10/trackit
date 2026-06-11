import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { authBackend } from '@/core/auth/backend';
import { useAuthStore } from '@/core/auth/auth-store';
import { PinPad } from '@/core/auth/PinPad';
import { Screen, Text } from '@/ui';

export default function SetPinScreen() {
  const router = useRouter();
  const refreshLockEnabled = useAuthStore((state) => state.refreshLockEnabled);
  const [firstEntry, setFirstEntry] = useState<string>();
  const [error, setError] = useState<string>();
  const [resetSignal, setResetSignal] = useState(0);

  async function onComplete(pin: string) {
    if (firstEntry === undefined) {
      setFirstEntry(pin);
      setError(undefined);
      setResetSignal((value) => value + 1);
      return;
    }
    if (pin !== firstEntry) {
      setFirstEntry(undefined);
      setError('PINs did not match — try again');
      setResetSignal((value) => value + 1);
      return;
    }
    await authBackend.setPin(pin);
    await refreshLockEnabled();
    close();
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }

  return (
    <Screen className="justify-between py-10">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="items-end px-6">
        <Pressable onPress={close} className="active:opacity-70">
          <Text variant="label" className="text-primary-bright">
            Cancel
          </Text>
        </Pressable>
      </View>
      <PinPad
        title={firstEntry === undefined ? 'Set a PIN' : 'Confirm PIN'}
        subtitle={
          firstEntry === undefined
            ? 'Choose a 4-digit PIN'
            : 'Re-enter to confirm'
        }
        error={error}
        resetSignal={resetSignal}
        onComplete={onComplete}
      />
      <View />
    </Screen>
  );
}
