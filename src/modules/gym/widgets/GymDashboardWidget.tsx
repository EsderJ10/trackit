import { useRouter } from 'expo-router';
import { Dumbbell, Play } from 'lucide-react-native';
import { View } from 'react-native';

import { ModuleWidgetShell } from '@/core/dashboard/ModuleWidgetShell';
import { useSettings } from '@/core/settings/use-settings';
import type { DashboardWidgetProps } from '@/core/types/module';
import { Button, Icon, Stat, Text, colors } from '@/ui';

import { formatRelativeDate, formatWeight } from '../format';
import { useActiveSession, useGymStats } from '../queries';

export function GymDashboardWidget(_props: DashboardWidgetProps) {
  const router = useRouter();
  const stats = useGymStats();
  const active = useActiveSession();
  const { weightUnit } = useSettings();

  function startOrResume() {
    if (active) {
      router.push({
        pathname: '/modules/gym/workout',
        params: { sessionId: String(active.id) },
      });
    } else {
      router.navigate('/train');
    }
  }

  return (
    <ModuleWidgetShell
      title="Gym"
      icon={Dumbbell}
      accent={colors.gym}
      onPress={() => router.navigate('/train')}
    >
      {active ? (
        <View className="flex-row items-center gap-2">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: colors.gym }}
          />
          <Text variant="muted">
            Workout in progress · {active.routineName ?? 'Freestyle'}
          </Text>
        </View>
      ) : stats.lastWorkout ? (
        <Text variant="muted">
          Last: {stats.lastWorkout.name} ·{' '}
          {formatRelativeDate(stats.lastWorkout.finishedAt)}
        </Text>
      ) : (
        <Text variant="muted">No workouts yet — start your first one.</Text>
      )}

      <View className="mt-4 flex-row justify-between">
        <Stat
          label="Sets / wk"
          value={String(stats.weeklySets)}
          accent={colors.gym}
        />
        <Stat
          label="Volume / wk"
          value={formatWeight(stats.weeklyVolume, weightUnit)}
          accent={colors.gym}
        />
      </View>

      <Button
        className="mt-4"
        size="md"
        label={active ? 'Resume workout' : 'Start workout'}
        leftIcon={<Icon icon={Play} size={16} color={colors.fg} />}
        onPress={startOrResume}
      />
    </ModuleWidgetShell>
  );
}
