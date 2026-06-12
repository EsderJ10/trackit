import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from './cn';
import { Text } from './Text';
import { colors } from './theme';

export interface TextFieldProps extends Omit<
  TextInputProps,
  'placeholderTextColor' | 'className'
> {
  /** Optional uppercase caption shown above the input. */
  label?: string;
  /** Validation/error message shown below the input (also reddens the border). */
  error?: string;
  /** Wrapper className (the input itself is themed internally). */
  className?: string;
}

/**
 * Themed single-line text input — the shared form primitive (login, register,
 * change-password, …). Forwards every native `TextInput` prop, so callers set
 * `secureTextEntry`, `keyboardType`, `autoCapitalize`, `textContentType`, etc.
 */
export function TextField({
  label,
  error,
  className,
  ...input
}: TextFieldProps) {
  return (
    <View className={cn('gap-1.5', className)}>
      {label ? (
        <Text variant="caption" className="uppercase tracking-wider">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.fgFaint}
        className={cn(
          'rounded-xl border bg-surface-hi px-4 py-3.5 text-base text-fg',
          error ? 'border-danger' : 'border-border',
        )}
        {...input}
      />
      {error ? (
        <Text variant="caption" className="text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
