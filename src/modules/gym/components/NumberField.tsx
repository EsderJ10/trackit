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
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
}

/** Compact numeric input used across the gym module; label is optional. */
export function NumberField({
  label,
  value,
  placeholder,
  onChangeText,
  onEndEditing,
  className,
  accessibilityLabel,
  returnKeyType,
  onSubmitEditing,
}: NumberFieldProps) {
  return (
    <View className={cn('gap-1', className)}>
      {label ? (
        <Text variant="caption" className="uppercase tracking-wider">
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        placeholder={placeholder}
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
        keyboardType="numeric"
        selectTextOnFocus
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={colors.fgFaint}
        // Tabular numerals so digits keep a fixed width and don't jitter as the
        // value changes (the logger's core readability requirement).
        style={{ fontVariant: ['tabular-nums'] }}
        className="rounded-xl border border-border bg-surface-hi px-3 py-3 text-center text-base text-fg"
      />
    </View>
  );
}
