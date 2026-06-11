import '../global.css';

import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDatabaseReady } from '@/core/db/ready';
import { colors, navigationTheme, Text } from '@/ui';

export default function RootLayout() {
  const { ready, error } = useDatabaseReady();

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
            <Stack screenOptions={{ headerShown: false }} />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
