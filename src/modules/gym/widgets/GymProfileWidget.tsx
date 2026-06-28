import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Trophy,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useSettings } from '@/core/settings/use-settings';
import type { DashboardWidgetProps } from '@/core/types/module';
import { Card, EmptyState, Icon, Stat, Text, cn, colors, tint } from '@/ui';

import { MuscleVolumeBars } from '../components/MuscleVolumeBars';
import { formatWeight } from '../format';
import { useExercisePRs, useGymProfileStats, useWeeklyGoal } from '../queries';
import { dayKey } from '../streak';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** Compact thousands formatting (e.g. 12.4k) for big lifetime counters. */
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
      <CalendarCard workoutDays={stats.workoutDays} />
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

function CalendarCard({ workoutDays }: { workoutDays: string[] }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loggedDays = useMemo(() => new Set(workoutDays), [workoutDays]);

  const { todayKey, currentMonthIndex } = useMemo(() => {
    const now = new Date();
    return {
      todayKey: dayKey(now),
      currentMonthIndex: now.getFullYear() * 12 + now.getMonth(),
    };
  }, []);

  const weeks = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return { year, month, rows };
  }, [viewMonth]);

  const viewMonthIndex = weeks.year * 12 + weeks.month;
  const canGoNext = viewMonthIndex < currentMonthIndex;

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() =>
            setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
          }
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Icon icon={ChevronLeft} size={20} color={colors.fgMuted} />
        </Pressable>
        <Text variant="label">
          {viewMonth.toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <Pressable
          onPress={() =>
            canGoNext &&
            setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
          }
          disabled={!canGoNext}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Icon
            icon={ChevronRight}
            size={20}
            color={canGoNext ? colors.fgMuted : colors.fgFaint}
          />
        </Pressable>
      </View>

      <View className="flex-row">
        {WEEKDAYS.map((label, i) => (
          <View key={i} className="flex-1 items-center">
            <Text variant="caption">{label}</Text>
          </View>
        ))}
      </View>

      {weeks.rows.map((row, r) => (
        <View key={r} className="flex-row">
          {row.map((day, c) => {
            if (day == null) return <View key={c} className="flex-1" />;
            const key = dayKey(new Date(weeks.year, weeks.month, day));
            const logged = loggedDays.has(key);
            const isToday = key === todayKey;
            return (
              <View key={c} className="flex-1 items-center py-1">
                <View
                  className={cn(
                    'h-8 w-8 items-center justify-center rounded-full',
                  )}
                  style={
                    logged
                      ? { backgroundColor: tint(colors.gym, 0.25) }
                      : isToday
                        ? { borderWidth: 1, borderColor: colors.border }
                        : undefined
                  }
                >
                  <Text
                    variant="muted"
                    style={logged ? { color: colors.gym } : undefined}
                  >
                    {day}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );
}
