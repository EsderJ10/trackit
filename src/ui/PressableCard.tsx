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

/**
 * A tappable `Card` surface. Mirrors `Card`'s elevated styling but is itself the
 * `Pressable`, baking in `accessibilityRole="button"`, the spoken label, and a
 * pressed state — so the many "Pressable wrapping a Card" navigation surfaces
 * share one accessible primitive instead of each re-deriving it (and forgetting
 * the a11y). Pass `className` to override the surface (bg, border, padding).
 */
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
