import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import type { DashboardWidgetProps } from '@/core/types/module';
import { Card, EmptyState, Icon, Stat, Text, cn, colors } from '@/ui';

import { formatWeight } from '../format';
import { useGymProfileStats } from '../queries';
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
      <LifetimeCard stats={stats} weightUnit={weightUnit} />
      <MuscleCard breakdown={stats.muscleBreakdown} />
      <CalendarCard workoutDays={stats.workoutDays} />
    </View>
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

function MuscleCard({
  breakdown,
}: {
  breakdown: ReturnType<typeof useGymProfileStats>['muscleBreakdown'];
}) {
  const max = Math.max(1, ...breakdown.map((m) => m.sets));
  return (
    <Card className="gap-3">
      <Text variant="label">This week by muscle</Text>
      {breakdown.length === 0 ? (
        <Text variant="muted">No sets logged in the last 7 days.</Text>
      ) : (
        breakdown.map((m) => (
          <View key={m.muscleGroup} className="gap-1">
            <View className="flex-row justify-between">
              <Text variant="muted" className="capitalize">
                {m.muscleGroup}
              </Text>
              <Text variant="muted">{m.sets}</Text>
            </View>
            <View className="h-2 overflow-hidden rounded-full bg-surface-hi">
              <View
                className="h-2 rounded-full"
                style={{
                  width: `${(m.sets / max) * 100}%`,
                  backgroundColor: colors.gym,
                }}
              />
            </View>
          </View>
        ))
      )}
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
                      ? { backgroundColor: `${colors.gym}40` }
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
