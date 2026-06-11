import type { ReactNode } from 'react';
import { View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { cn } from './cn';
import { colors } from './theme';

export interface ScreenProps {
  children: ReactNode;
  /** Extra classes for the inner content container. */
  className?: string;
  /** Which safe-area edges to inset. Defaults to top + bottom. */
  edges?: readonly Edge[];
}

/** Full-bleed screen container on the app background with safe-area insets. */
export function Screen({
  children,
  className,
  edges = ['top', 'bottom'],
}: ScreenProps) {
  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View className={cn('flex-1', className)}>{children}</View>
    </SafeAreaView>
  );
}
