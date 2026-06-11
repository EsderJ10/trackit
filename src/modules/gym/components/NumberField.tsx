import { TextInput, View } from 'react-native';

import { Text, cn, colors } from '@/ui';

export interface NumberFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  onEndEditing?: () => void;
  className?: string;
}

/** Compact numeric input used across the gym module; label is optional. */
export function NumberField({
  label,
  value,
  onChangeText,
  onEndEditing,
  className,
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
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
        keyboardType="numeric"
        selectTextOnFocus
        placeholderTextColor={colors.fgFaint}
        className="rounded-xl border border-border bg-surface-hi px-3 py-3 text-center text-base text-fg"
      />
    </View>
  );
}
