import { Minus, Plus, Timer, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text, colors, glow } from '@/ui';

import { formatDuration } from '../format';
import { REST_STEP_MS, useRestTimer } from '../rest-timer-store';

/**
 * Sticky between-sets countdown. Renders nothing when idle; while running it
 * ticks off the store's absolute `endsAt` and self-dismisses at zero. The ±15s
 * controls reshape the running timer; the ✕ skips it.
 */
export function RestTimerBar() {
  const endsAt = useRestTimer((state) => state.endsAt);
  const adjust = useRestTimer((state) => state.adjust);
  const stop = useRestTimer((state) => state.stop);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt == null) return;
    // Sync to the wall clock the moment a rest starts; `now` only advances while
    // the interval runs, so without this the first frame shows a stale
    // (inflated) remaining until the first tick.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  useEffect(() => {
    if (endsAt != null && now >= endsAt) stop();
  }, [endsAt, now, stop]);

  if (endsAt == null) return null;
  const remaining = Math.max(0, endsAt - now);

  return (
    <View
      className="mx-5 mb-2 flex-row items-center gap-3 rounded-2xl border border-border-soft bg-surface-hi px-4 py-3"
      style={glow(colors.gym, 0.4)}
    >
      <Icon icon={Timer} size={20} color={colors.gym} />
      <Text
        variant="heading"
        className="flex-1"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatDuration(remaining)}
      </Text>

      <Pressable
        onPress={() => adjust(-REST_STEP_MS)}
        accessibilityRole="button"
        accessibilityLabel="Subtract 15 seconds from rest"
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full border border-border active:opacity-70"
      >
        <Icon icon={Minus} size={16} color={colors.fg} />
      </Pressable>
      <Pressable
        onPress={() => adjust(REST_STEP_MS)}
        accessibilityRole="button"
        accessibilityLabel="Add 15 seconds to rest"
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full border border-border active:opacity-70"
      >
        <Icon icon={Plus} size={16} color={colors.fg} />
      </Pressable>
      <Pressable
        onPress={stop}
        accessibilityRole="button"
        accessibilityLabel="Skip rest"
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full bg-surface-alt active:opacity-70"
      >
        <Icon icon={X} size={18} color={colors.fgFaint} />
      </Pressable>
    </View>
  );
}
