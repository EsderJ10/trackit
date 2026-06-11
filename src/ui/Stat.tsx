import { View } from 'react-native';

import { cn } from './cn';
import { Text } from './Text';

export interface StatProps {
  label: string;
  value: string;
  /** Optional accent hex for the value (e.g. a module color). */
  accent?: string;
  className?: string;
}

/** A single high-contrast data point: big value over a quiet label. */
export function Stat({ label, value, accent, className }: StatProps) {
  return (
    <View className={cn(className)}>
      <Text variant="stat" style={accent ? { color: accent } : undefined}>
        {value}
      </Text>
      <Text variant="caption" className="mt-1 uppercase tracking-wider">
        {label}
      </Text>
    </View>
  );
}
