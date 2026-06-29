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
import { useSessionStore } from '@/core/auth/session-store';
import { useDatabaseReady } from '@/core/db/ready';
import { MODULES } from '@/core/module-registry';
import { colors, navigationTheme, Text } from '@/ui';

export default function RootLayout() {
  const { ready, error } = useDatabaseReady();

  // Device lock (PIN/biometric) — orthogonal to identity below.
  const initAuth = useAuthStore((state) => state.init);
  const authInitialized = useAuthStore((state) => state.initialized);
  const lockEnabled = useAuthStore((state) => state.lockEnabled);
  const locked = useAuthStore((state) => state.locked);

  // Identity/session — decides login vs app.
  const initSession = useSessionStore((state) => state.init);
  const sessionInitialized = useSessionStore((state) => state.initialized);
  const isAuthed = useSessionStore((state) => state.user !== null);

  // The lock reads SecureStore only, so it can init immediately. The session
  // reads the `users` table, so it must wait until migrations have applied.
  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (ready) void initSession();
  }, [ready, initSession]);

  // Re-lock when the app goes to the background (logged-in users only).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') useAuthStore.getState().lock();
    });
    return () => subscription.remove();
  }, []);

  const bootstrapped = ready && authInitialized && sessionInitialized;
  // The PIN lock overlays the app only once the user is signed in.
  const showLock = isAuthed && lockEnabled && locked;

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
          ) : !bootstrapped ? (
            <View className="flex-1 items-center justify-center bg-bg">
              <ActivityIndicator color={colors.primaryGlow} />
            </View>
          ) : (
            <>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Protected guard={isAuthed}>
                  <Stack.Screen name="(tabs)" />
                  {/* No app/modules/_layout — these nested stacks are root
                      screens, so gate them by their full segment names. The
                      nav-owning modules are registry-driven so a new one needs
                      no edit here; `modules/[moduleId]` is the generic fallback
                      for simple (ModuleScreen-only) modules. */}
                  {MODULES.filter((module) => module.ownsRouteStack).map(
                    (module) => (
                      <Stack.Screen
                        key={module.meta.id}
                        name={`modules/${module.meta.id}`}
                      />
                    ),
                  )}
                  <Stack.Screen name="modules/[moduleId]" />
                  <Stack.Screen
                    name="settings"
                    options={{ presentation: 'modal' }}
                  />
                  <Stack.Screen
                    name="dashboard"
                    options={{ presentation: 'modal' }}
                  />
                  <Stack.Screen
                    name="set-pin"
                    options={{ presentation: 'modal' }}
                  />
                </Stack.Protected>
                <Stack.Protected guard={!isAuthed}>
                  <Stack.Screen name="(auth)" />
                </Stack.Protected>
              </Stack>
              {showLock ? <LockScreen /> : null}
            </>
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
