import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { Text, cn, colors } from '@/ui';

export interface NumberFieldProps {
  label?: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
  onEndEditing?: () => void;
  className?: string;
  /**
   * Spoken label for screen readers. Mid-workout the visual `label` is usually
   * omitted to save width, so without this the field is announced as an
   * unlabeled input — always pass a semantic label for the logger controls.
   */
  accessibilityLabel?: string;
  /** Reddens the border to flag an out-of-range / unparseable value. */
  invalid?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  /** Keep focus after submit so a chained next-field focus isn't fought by blur. */
  blurOnSubmit?: TextInputProps['blurOnSubmit'];
}

/**
 * Compact numeric input used across the gym module; label is optional. Forwards
 * its ref to the underlying `TextInput` so callers can chain focus between fields
 * (reps → weight → RPE) via `returnKeyType="next"`.
 */
export const NumberField = forwardRef<TextInput, NumberFieldProps>(
  function NumberField(
    {
      label,
      value,
      placeholder,
      onChangeText,
      onEndEditing,
      className,
      accessibilityLabel,
      invalid = false,
      returnKeyType,
      onSubmitEditing,
      blurOnSubmit,
    },
    ref,
  ) {
    return (
      <View className={cn('gap-1', className)}>
        {label ? (
          <Text variant="caption" className="uppercase tracking-wider">
            {label}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          value={value}
          placeholder={placeholder}
          onChangeText={onChangeText}
          onEndEditing={onEndEditing}
          keyboardType="numeric"
          selectTextOnFocus
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          accessibilityLabel={accessibilityLabel ?? label}
          placeholderTextColor={colors.fgFaint}
          // Tabular numerals so digits keep a fixed width and don't jitter as the
          // value changes (the logger's core readability requirement).
          style={{ fontVariant: ['tabular-nums'] }}
          className={cn(
            'rounded-xl border bg-surface-hi px-3 py-3 text-center text-base text-fg',
            invalid ? 'border-danger' : 'border-border',
          )}
        />
      </View>
    );
  },
);
