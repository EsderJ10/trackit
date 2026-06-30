import { useRouter } from 'expo-router';
import { Play, X } from 'lucide-react-native';
import { Alert, Pressable, View } from 'react-native';

import { Icon, Text, colors, glow, tint } from '@/ui';

import { deleteSession, useActiveSession } from '../queries';
import { sessionLabelLine } from '../session-label';

/**
 * Persistent "resume workout" bar pinned above the tab bar (the gym module's
 * `GlobalBar`). Lets the user jump back into an in-progress workout from any tab,
 * Strong/Liftosaur-style. Renders nothing when no workout is in progress.
 */
export function ActiveWorkoutBar() {
  const router = useRouter();
  const active = useActiveSession();
  if (active == null) return null;

  const discard = () =>
    Alert.alert(
      'Discard workout?',
      `Discard "${sessionLabelLine(active)}" and any sets logged in it? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => deleteSession(active.id),
        },
      ],
    );

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/modules/gym/workout',
          params: { sessionId: String(active.id) },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`Resume workout: ${sessionLabelLine(active)}`}
      className="mx-3 mb-1 mt-2 flex-row items-center gap-3 rounded-2xl border bg-surface-hi px-4 py-2.5 active:opacity-80"
      style={{ borderColor: colors.gym, ...glow(colors.gym, 0.4) }}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: tint(colors.gym, 0.15) }}
      >
        <Icon icon={Play} size={18} color={colors.gym} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: colors.gym }}
          />
          <Text variant="label" style={{ color: colors.gym }}>
            Workout in progress
          </Text>
        </View>
        <Text variant="caption" numberOfLines={1}>
          {sessionLabelLine(active)} · tap to resume
        </Text>
      </View>
      <Pressable
        onPress={discard}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Discard workout in progress"
        className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
      >
        <Icon icon={X} size={18} color={colors.fgMuted} />
      </Pressable>
    </Pressable>
  );
}
