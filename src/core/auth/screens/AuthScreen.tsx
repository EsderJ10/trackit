import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/ui';

interface AuthScreenProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** Shared scaffold for the login/register screens: centered, keyboard-aware. */
export function AuthScreen({ title, subtitle, children }: AuthScreenProps) {
  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center gap-8 p-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-2">
            <Text variant="display">{title}</Text>
            <Text variant="muted">{subtitle}</Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
