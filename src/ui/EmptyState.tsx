import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Mascot, type MascotState } from './Mascot';
import { Text } from './Text';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * Opt-in FORGE golem illustration. When set, the mascot renders above the
   * title (and takes precedence over `icon`). Omitting it keeps the legacy
   * icon-only layout untouched — existing call sites are unaffected.
   */
  mascot?: MascotState;
}

/** Centered placeholder for empty lists / first-run states. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  mascot,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-8">
      {mascot ? <Mascot state={mascot} size={120} /> : icon}
      <Text variant="heading" className="text-center">
        {title}
      </Text>
      {description ? (
        <Text variant="muted" className="text-center">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
