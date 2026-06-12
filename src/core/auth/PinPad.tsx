import { Delete } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text, cn, colors } from '@/ui';

export const PIN_LENGTH = 4;

const KEYS: readonly string[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del',
];

export interface PinPadProps {
  title: string;
  subtitle?: string;
  error?: string;
  /** Increment to clear the entry (e.g. after a wrong PIN). */
  resetSignal?: number;
  onComplete: (pin: string) => void;
}

/** Numeric PIN entry with progress dots. Calls `onComplete` at PIN_LENGTH. */
export function PinPad({
  title,
  subtitle,
  error,
  resetSignal = 0,
  onComplete,
}: PinPadProps) {
  const [pin, setPin] = useState('');

  // Clear the entry when the parent bumps `resetSignal` (e.g. a wrong PIN).
  // Adjusting state during render on a changed prop is React's recommended
  // alternative to a setState-in-effect for this "reset on signal" pattern.
  const [prevReset, setPrevReset] = useState(resetSignal);
  if (resetSignal !== prevReset) {
    setPrevReset(resetSignal);
    setPin('');
  }

  function press(key: string) {
    if (key === '') return;
    if (key === 'del') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + key;
      if (next.length === PIN_LENGTH) onComplete(next);
      return next;
    });
  }

  return (
    <View className="items-center gap-8">
      <View className="items-center gap-2">
        <Text variant="title">{title}</Text>
        {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
      </View>

      <View className="flex-row gap-4">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            className={cn(
              'h-4 w-4 rounded-full border',
              i < pin.length
                ? 'border-primary-glow bg-primary-glow'
                : 'border-border bg-transparent',
            )}
          />
        ))}
      </View>

      <Text variant="caption" className="h-4 text-danger">
        {error ?? ''}
      </Text>

      <View className="w-72 flex-row flex-wrap">
        {KEYS.map((key, i) => (
          <View key={i} className="h-20 w-1/3 items-center justify-center p-2">
            {key === '' ? null : (
              <Pressable
                onPress={() => press(key)}
                className="h-16 w-16 items-center justify-center rounded-full bg-surface active:bg-surface-hi"
              >
                {key === 'del' ? (
                  <Icon icon={Delete} size={22} color={colors.fgMuted} />
                ) : (
                  <Text variant="title">{key}</Text>
                )}
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
