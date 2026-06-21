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
import { Card, EmptyState, Icon, Stat, Text, cn, colors } from '@/ui';

import { formatWeight } from '../format';
import {
  classifyVolume,
  type MuscleLandmarkBands,
  type VolumeZone,
  ZONE_LABEL,
} from '../landmarks';
import {
  useExercisePRs,
  useGymProfileStats,
  useMuscleLandmarks,
  useWeeklyGoal,
} from '../queries';
import { dayKey } from '../streak';

/** Fill color per volume zone, low→high stimulus. */
const ZONE_COLOR: Record<VolumeZone, string> = {
  'below-mv': colors.fgFaint,
  maintenance: colors.warning,
  productive: colors.success,
  maximal: colors.gym,
  overreaching: colors.danger,
};

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
      <MuscleCard breakdown={stats.muscleBreakdown} />
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

function MuscleCard({
  breakdown,
}: {
  breakdown: ReturnType<typeof useGymProfileStats>['muscleBreakdown'];
}) {
  const landmarks = useMuscleLandmarks();
  // Fallback scale for muscles without landmarks (e.g. custom groups).
  const max = Math.max(1, ...breakdown.map((m) => m.sets));
  return (
    <Card className="gap-3">
      <Text variant="label">This week by muscle</Text>
      {breakdown.length === 0 ? (
        <Text variant="muted">No sets logged in the last 7 days.</Text>
      ) : (
        <>
          <Text variant="caption">Weekly sets vs your MEV · MAV · MRV bands</Text>
          {breakdown.map((m) => (
            <MuscleVolumeRow
              key={m.muscleGroup}
              muscleGroup={m.muscleGroup}
              sets={m.sets}
              landmark={landmarks.get(m.muscleGroup)}
              fallbackMax={max}
            />
          ))}
          <ZoneLegend />
        </>
      )}
    </Card>
  );
}

function MuscleVolumeRow({
  muscleGroup,
  sets,
  landmark,
  fallbackMax,
}: {
  muscleGroup: string;
  sets: number;
  landmark: MuscleLandmarkBands | undefined;
  fallbackMax: number;
}) {
  if (!landmark) {
    // No landmark (custom muscle group): plain relative bar, no zone framing.
    return (
      <View className="gap-1">
        <View className="flex-row justify-between">
          <Text variant="muted" className="capitalize">
            {muscleGroup}
          </Text>
          <Text variant="muted">{sets}</Text>
        </View>
        <View className="h-2.5 overflow-hidden rounded-full bg-surface-hi">
          <View
            className="h-2.5 rounded-full"
            style={{
              width: `${(sets / fallbackMax) * 100}%`,
              backgroundColor: colors.gym,
            }}
          />
        </View>
      </View>
    );
  }

  const zone = classifyVolume(sets, landmark);
  // Headroom past MRV so an over-the-ceiling bar still reads as "past the line".
  const scaleMax = Math.max(landmark.mrv, sets) * 1.06;
  const pct = (v: number) => `${(v / scaleMax) * 100}%` as const;
  const ticks = [landmark.mev, landmark.mav, landmark.mrv];

  return (
    <View className="gap-1">
      <View className="flex-row justify-between">
        <Text variant="muted" className="capitalize">
          {muscleGroup}
        </Text>
        <Text variant="muted">
          {sets} · {ZONE_LABEL[zone]}
        </Text>
      </View>
      <View className="relative h-2.5 overflow-hidden rounded-full bg-surface-hi">
        <View
          className="absolute bottom-0 left-0 top-0 rounded-full"
          style={{ width: pct(sets), backgroundColor: ZONE_COLOR[zone] }}
        />
        {ticks.map((t, i) => (
          <View
            key={i}
            className="absolute bottom-0 top-0"
            style={{ left: pct(t), width: 1.5, backgroundColor: colors.bg }}
          />
        ))}
      </View>
    </View>
  );
}

function ZoneLegend() {
  const items: { zone: VolumeZone; label: string }[] = [
    { zone: 'maintenance', label: ZONE_LABEL.maintenance },
    { zone: 'productive', label: ZONE_LABEL.productive },
    { zone: 'maximal', label: ZONE_LABEL.maximal },
    { zone: 'overreaching', label: ZONE_LABEL.overreaching },
  ];
  return (
    <View className="flex-row flex-wrap gap-x-3 gap-y-1 pt-1">
      {items.map((it) => (
        <View key={it.zone} className="flex-row items-center gap-1.5">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: ZONE_COLOR[it.zone] }}
          />
          <Text variant="caption">{it.label}</Text>
        </View>
      ))}
    </View>
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
