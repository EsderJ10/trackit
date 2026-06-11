import '../global.css';

import { Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDatabaseReady } from '@/core/db/ready';

export default function RootLayout() {
  const { ready, error } = useDatabaseReady();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {error ? (
          <View className="flex-1 items-center justify-center bg-white p-6">
            <Text className="text-base font-semibold text-red-600">
              Failed to initialize the database.
            </Text>
            <Text className="mt-2 text-center text-xs text-slate-500">
              {error.message}
            </Text>
          </View>
        ) : !ready ? (
          <View className="flex-1 items-center justify-center bg-white">
            <ActivityIndicator />
          </View>
        ) : (
          <Stack screenOptions={{ headerShown: false }} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
