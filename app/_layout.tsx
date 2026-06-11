import '../global.css';

import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '@/core/auth/auth-store';
import { LockScreen } from '@/core/auth/LockScreen';
import { useDatabaseReady } from '@/core/db/ready';
import { colors, navigationTheme, Text } from '@/ui';

export default function RootLayout() {
  const { ready, error } = useDatabaseReady();
  const initAuth = useAuthStore((state) => state.init);
  const authInitialized = useAuthStore((state) => state.initialized);
  const lockEnabled = useAuthStore((state) => state.lockEnabled);
  const locked = useAuthStore((state) => state.locked);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  // Re-lock when the app goes to the background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') useAuthStore.getState().lock();
    });
    return () => subscription.remove();
  }, []);

  const showLock = authInitialized && lockEnabled && locked;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="light" />
          {error ? (
            <View className="flex-1 items-center justify-center bg-bg p-6">
              <Text variant="heading" className="text-danger">
                Failed to initialize the database.
              </Text>
              <Text variant="caption" className="mt-2 text-center">
                {error.message}
              </Text>
            </View>
          ) : !ready ? (
            <View className="flex-1 items-center justify-center bg-bg">
              <ActivityIndicator color={colors.primaryGlow} />
            </View>
          ) : (
            <>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="set-pin" options={{ presentation: 'modal' }} />
              </Stack>
              {showLock ? <LockScreen /> : null}
            </>
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
