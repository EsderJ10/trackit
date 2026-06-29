import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';

import { cn } from './cn';

export interface PressableCardProps extends Omit<
  PressableProps,
  'children' | 'accessibilityLabel'
> {
  children: ReactNode;
  /**
   * Spoken label for the touch target. Required — these are navigation
   * surfaces, and a bare `Pressable` wrapping a `Card` announces only its inner
   * text (or nothing), so the label is not optional.
   */
  accessibilityLabel: string;
  className?: string;
}

/** Tappable `Card`: itself the `Pressable` with baked-in a11y, so navigation surfaces share one accessible primitive. Override surface via `className`. */
export function PressableCard({
  children,
  accessibilityLabel,
  className,
  ...rest
}: PressableCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={cn(
        'rounded-2xl border border-border-soft bg-surface p-4',
        'active:opacity-80',
        className,
      )}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
