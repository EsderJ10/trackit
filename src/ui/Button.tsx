import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
} from 'react-native';

import { cn } from './cn';
import { Text } from './Text';
import { colors, glow } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-surface-hi border border-border',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-fg',
  secondary: 'text-fg',
  ghost: 'text-primary-bright',
  // Dark label on the light danger pink — #F4F3FB gave only 2.72:1 (fails AA);
  // the dark ground reads at 5.71:1.
  danger: 'text-bg',
};

const SIZE: Record<ButtonSize, string> = {
  md: 'h-12 px-5',
  lg: 'h-14 px-6',
};

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  className?: string;
}

/** Primary CTA with spacious tap target and an optional soft glow. */
export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  loading = false,
  leftIcon,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled === true || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={
        variant === 'primary' && !isDisabled
          ? glow(colors.primaryGlow, 0.4)
          : undefined
      }
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-2xl',
        CONTAINER[variant],
        SIZE[size],
        isDisabled && 'opacity-50',
        'active:opacity-80',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors.fg} />
      ) : (
        <>
          {leftIcon}
          <Text
            numberOfLines={1}
            className={cn('text-base font-semibold', LABEL[variant])}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
