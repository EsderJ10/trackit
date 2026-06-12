import { Dumbbell } from 'lucide-react-native';
import { View } from 'react-native';

import { ModuleWidgetShell } from '@/core/dashboard/ModuleWidgetShell';
import { useSettings } from '@/core/settings/use-settings';
import type { DashboardWidgetProps } from '@/core/types/module';
import { Stat, Text, colors } from '@/ui';

import { formatRelativeDate, formatWeight } from '../format';
import { useGymStats } from '../queries';

export function GymDashboardWidget(_props: DashboardWidgetProps) {
  const stats = useGymStats();
  const { weightUnit } = useSettings();

  return (
    <ModuleWidgetShell title="Gym" icon={Dumbbell} accent={colors.gym}>
      {stats.lastWorkout ? (
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
    </ModuleWidgetShell>
  );
}
