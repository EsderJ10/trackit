import { useRouter } from 'expo-router';
import { ChevronRight, Dumbbell, Flame, Trophy } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useSettings } from '@/core/settings/use-settings';
import type { DashboardWidgetProps } from '@/core/types/module';
import { Card, EmptyState, Icon, Stat, Text, colors } from '@/ui';

import { MuscleVolumeBars } from '../components/MuscleVolumeBars';
import { formatWeight } from '../format';
import { useExercisePRs, useGymProfileStats, useWeeklyGoal } from '../queries';

function compact(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
}

export function GymProfileWidget(_props: DashboardWidgetProps) {
  const stats = useGymProfileStats();
  const { weightUnit } = useSettings();

  if (stats.totalWorkouts === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Icon icon={Dumbbell} size={40} color={colors.fgFaint} />}
          title="No workouts yet"
          description="Finish your first session to start building stats and a streak."
        />
      </Card>
    );
  }

  return (
    <View className="gap-3">
      <WeeklyGoalCard done={stats.thisWeekWorkouts} />
      <LifetimeCard stats={stats} weightUnit={weightUnit} />
      <PRsCard weightUnit={weightUnit} />
      <MuscleVolumeBars breakdown={stats.muscleBreakdown} />
    </View>
  );
}

function WeeklyGoalCard({ done }: { done: number }) {
  const goal = useWeeklyGoal();
  const reached = done >= goal;

  const size = 64;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = goal > 0 ? Math.min(1, done / goal) : 0;

  return (
    <Card className="flex-row items-center gap-4">
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.surfaceHi}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.gym}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          <Text variant="label">{done}</Text>
        </View>
      </View>
      <View className="flex-1">
        <Text variant="heading">This week</Text>
        <Text variant="muted">
          {reached
            ? `Goal reached — ${done} of ${goal} workouts`
            : `${done} of ${goal} workouts`}
        </Text>
      </View>
    </Card>
  );
}

function LifetimeCard({
  stats,
  weightUnit,
}: {
  stats: ReturnType<typeof useGymProfileStats>;
  weightUnit: 'kg' | 'lb';
}) {
  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={Flame} size={18} color={colors.gym} />
        <Text variant="heading">
          {stats.streakWeeks > 0
            ? `${stats.streakWeeks}-week streak`
            : 'No active streak'}
        </Text>
        {stats.longestStreakWeeks > 0 ? (
          <Text variant="caption" className="ml-auto">
            Best: {stats.longestStreakWeeks} wk
          </Text>
        ) : null}
      </View>
      <View className="flex-row justify-between">
        <Stat
          label="Workouts"
          value={String(stats.totalWorkouts)}
          accent={colors.gym}
        />
        <Stat
          label="Total sets"
          value={compact(stats.totalSets)}
          accent={colors.gym}
        />
        <Stat
          label="Volume"
          value={formatWeight(stats.totalVolume, weightUnit)}
          accent={colors.gym}
        />
      </View>
    </Card>
  );
}

function PRsCard({ weightUnit }: { weightUnit: 'kg' | 'lb' }) {
  const prs = useExercisePRs();
  const router = useRouter();

  if (prs.length === 0) return null;

  return (
    <Card className="gap-2">
      <View className="flex-row items-center gap-2">
        <Icon icon={Trophy} size={18} color={colors.gym} />
        <Text variant="label">Personal records</Text>
      </View>
      {prs.map((pr) => (
        <Pressable
          key={pr.exerciseId}
          onPress={() =>
            router.push({
              pathname: '/modules/gym/exercise',
              params: { exerciseId: String(pr.exerciseId) },
            })
          }
          className="flex-row items-center gap-3 rounded-xl bg-surface-alt px-3 py-2"
        >
          <Text variant="body" className="flex-1" numberOfLines={1}>
            {pr.exerciseName}
          </Text>
          <View className="items-end">
            <Text variant="label" style={{ color: colors.gym }}>
              {formatWeight(pr.best1RmKg, weightUnit)}
            </Text>
            <Text variant="caption">
              1RM · {formatWeight(pr.heaviestKg, weightUnit)} top
            </Text>
          </View>
          <Icon icon={ChevronRight} size={16} color={colors.fgFaint} />
        </Pressable>
      ))}
    </Card>
  );
}
