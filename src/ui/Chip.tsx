import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';

import { cn } from './cn';
import { colors } from './theme';

export type ChipShape = 'pill' | 'segment';

export interface ChipProps extends Omit<PressableProps, 'children'> {
  /** Whether this chip is the selected one. Drives the accent fill + a11y state. */
  active: boolean;
  /** Accent fill when active (defaults to the core primary; modules pass theirs). */
  accent?: string;
  /**
   * `pill` = bordered, fully-rounded filter chip; `segment` = a borderless tab
   * meant to sit inside a `bg-surface-hi` segmented container.
   */
  shape?: ChipShape;
  /** The label content — kept as a slot so each call site owns its text styling. */
  children: ReactNode;
  className?: string;
}

/**
 * A selectable chip — the shared container behind the filter pills and range
 * tabs that were re-implemented across screens. Owns the shape, accent fill, and
 * accessibility (`role=button` + `selected` state); the label stays a `children`
 * slot because call sites legitimately differ in their text treatment.
 */
export function Chip({
  active,
  accent = colors.primary,
  shape = 'pill',
  children,
  className,
  ...rest
}: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={cn(
        'px-3 py-1.5 active:opacity-70',
        shape === 'pill' ? 'rounded-full border' : 'rounded-lg',
        className,
      )}
      style={
        shape === 'pill'
          ? {
              backgroundColor: active ? accent : 'transparent',
              borderColor: active ? accent : colors.border,
            }
          : active
            ? { backgroundColor: accent }
            : undefined
      }
      {...rest}
    >
      {children}
    </Pressable>
  );
}
