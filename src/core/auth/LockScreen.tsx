import { Fingerprint } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Icon, Screen, colors } from '@/ui';

import { authBackend } from './backend';
import { useAuthStore } from './auth-store';
import { PinPad } from './PinPad';

// Lock overlay rendered above the navigator (not a route) to avoid a redirect dance.
export function LockScreen() {
  const unlock = useAuthStore((state) => state.unlock);
  const [error, setError] = useState<string>();
  const [resetSignal, setResetSignal] = useState(0);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  const tryBiometric = useCallback(async () => {
    if (!(await authBackend.canUseBiometrics())) return;
    if (await authBackend.authenticateBiometric()) unlock();
  }, [unlock]);

  useEffect(() => {
    let active = true;
    void authBackend.canUseBiometrics().then((available) => {
      if (active) setBiometricsAvailable(available);
    });
    void tryBiometric();
    return () => {
      active = false;
    };
  }, [tryBiometric]);

  async function onComplete(pin: string) {
    if (await authBackend.verifyPin(pin)) {
      unlock();
      return;
    }
    setError('Incorrect PIN');
    setResetSignal((value) => value + 1);
  }

  return (
    <View className="absolute inset-0 z-50 bg-bg">
      <Screen className="justify-between py-10">
        <View />
        <PinPad
          title="Enter PIN"
          subtitle="Unlock TrackIt"
          error={error}
          resetSignal={resetSignal}
          onComplete={onComplete}
        />
        <View className="px-6">
          {biometricsAvailable ? (
            <Button
              label="Use biometrics"
              variant="ghost"
              onPress={tryBiometric}
              leftIcon={
                <Icon
                  icon={Fingerprint}
                  size={20}
                  color={colors.primaryBright}
                />
              }
            />
          ) : null}
        </View>
      </Screen>
    </View>
  );
}
