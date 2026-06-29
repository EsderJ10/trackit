import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from './cn';
import { Text } from './Text';

export interface SectionHeaderProps {
  children: string;
  /** Optional trailing accessory (e.g. an action), right-aligned. */
  right?: ReactNode;
  className?: string;
}

/** Small uppercase group label used above a settings/profile section. */
export function SectionHeader({
  children,
  right,
  className,
}: SectionHeaderProps) {
  return (
    <View className={cn('flex-row items-center justify-between', className)}>
      <Text variant="caption" className="uppercase tracking-wider">
        {children}
      </Text>
      {right}
    </View>
  );
}

export interface SectionProps {
  title: string;
  children: ReactNode;
  /** Optional trailing accessory next to the title. */
  right?: ReactNode;
  className?: string;
}

/** A titled group: an uppercase header above its content, spaced consistently. */
export function Section({ title, children, right, className }: SectionProps) {
  return (
    <View className={cn('gap-2', className)}>
      <SectionHeader right={right}>{title}</SectionHeader>
      {children}
    </View>
  );
}
