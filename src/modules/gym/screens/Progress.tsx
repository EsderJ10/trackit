import { Stack } from 'expo-router';
import { ChevronDown, LineChart as LineChartIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import { toDisplayWeight } from '@/core/settings/units';
import {
  Card,
  EmptyState,
  Icon,
  LineChart,
  Screen,
  Stat,
  Text,
  colors,
} from '@/ui';

import {
  type StrengthSet,
  type VolumeSet,
  e1rmTrend,
  seriesPeak,
  seriesTotal,
  weeklySetCount,
  weeklyTonnage,
} from '../analytics';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { formatWeight } from '../format';
import {
  useExercisePRs,
  useExerciseSetHistory,
  useVolumeHistory,
} from '../queries';

const DAY_MS = 86_400_000;

const RANGES = [
  { key: '4W', label: '4W', days: 28 },
  { key: '12W', label: '12W', days: 84 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: 'All', label: 'All', days: 0 },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

/** The lower bound (ms) for a range relative to now; 0 days means all-time. */
function rangeFrom(days: number, now: number): number {
  return days === 0 ? 0 : now - days * DAY_MS;
}

/** Segmented range selector — same shape as the gym settings toggles. */
function RangeTabs({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
}) {
  return (
    <View className="flex-row gap-1 self-start rounded-xl bg-surface-hi p-1">
      {RANGES.map((range) => {
        const active = range.key === value;
        return (
          <Pressable
            key={range.key}
            onPress={() => onChange(range.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Show last ${range.label}`}
            className="rounded-lg px-3 py-1.5 active:opacity-70"
            style={active ? { backgroundColor: colors.gym } : undefined}
          >
            <Text
              style={{
                color: active ? colors.bg : colors.fgMuted,
                fontWeight: '600',
              }}
            >
              {range.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A titled chart card with a fallback when there aren't enough points yet. */
function ChartCard({
  title,
  series,
  children,
}: {
  title: string;
  series: number[];
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-3">
      <Text variant="heading">{title}</Text>
      {series.length >= 2 ? (
        <>
          <LineChart data={series} color={colors.gym} height={120} />
          <View className="flex-row gap-6">{children}</View>
        </>
      ) : (
        <Text variant="muted">
          Not enough data yet — log a few more sessions to see this trend.
        </Text>
      )}
    </Card>
  );
}

export function Progress() {
  const { weightUnit } = useSettings();
  const { data: volume } = useVolumeHistory();
  const prs = useExercisePRs(1);
  const [rangeKey, setRangeKey] = useState<RangeKey>('12W');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(
    null,
  );

  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];

  // Default the strength chart to the top-PR lift until the user picks another.
  const topPr = prs[0];
  const selectedId = picked?.id ?? topPr?.exerciseId ?? 0;
  const selectedName = picked?.name ?? topPr?.exerciseName ?? null;
  const { data: history } = useExerciseSetHistory(selectedId);

  const volumeTrends = useMemo(() => {
    // Intentional current-time read for the rolling range; the memo recomputes
    // when the data or range changes, which is when it matters.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const from = rangeFrom(range.days, now);
    const sets: VolumeSet[] = volume.map((row) => ({
      finishedAt: row.finishedAt?.getTime() ?? 0,
      reps: row.reps,
      weight: row.weight,
      setType: row.setType,
      measurementKind: row.measurementKind,
    }));
    const tonnage = weeklyTonnage(sets, from, now);
    const setCount = weeklySetCount(sets, from, now);
    return {
      tonnage,
      setCount,
      tonnageTotal: seriesTotal(tonnage),
      tonnagePeak: seriesPeak(tonnage),
      setsTotal: seriesTotal(setCount),
    };
  }, [volume, range.days]);

  const strength = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const from = rangeFrom(range.days, now);
    const rows: StrengthSet[] = history.map((row) => ({
      sessionId: row.sessionId,
      finishedAt: row.finishedAt?.getTime() ?? 0,
      reps: row.reps,
      weight: row.weight,
    }));
    return e1rmTrend(rows, from);
  }, [history, range.days]);

  const tonnageDisplay = volumeTrends.tonnage.map((p) =>
    toDisplayWeight(p.value, weightUnit),
  );
  const strengthDisplay = strength.map((kg) => toDisplayWeight(kg, weightUnit));
  const currentE1rm = strength[strength.length - 1] ?? 0;
  const peakE1rm = strength.length ? Math.max(...strength) : 0;

  if (volume.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Progress' }} />
        <EmptyState
          icon={<Icon icon={LineChartIcon} size={40} color={colors.fgFaint} />}
          title="No progress yet"
          description="Finish a few workouts and your strength and volume trends will appear here."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Progress' }} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <RangeTabs value={rangeKey} onChange={setRangeKey} />

        <ChartCard title="Weekly volume" series={tonnageDisplay}>
          <Stat
            label="Total volume"
            value={formatWeight(volumeTrends.tonnageTotal, weightUnit)}
            accent={colors.gym}
          />
          <Stat
            label="Peak week"
            value={formatWeight(volumeTrends.tonnagePeak, weightUnit)}
          />
          <Stat label="Hard sets" value={String(volumeTrends.setsTotal)} />
        </ChartCard>

        <ChartCard title="Estimated 1RM" series={strengthDisplay}>
          <Stat
            label="Current"
            value={formatWeight(currentE1rm, weightUnit)}
            accent={colors.gym}
          />
          <Stat label="Peak" value={formatWeight(peakE1rm, weightUnit)} />
        </ChartCard>

        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose exercise for the strength trend"
          className="active:opacity-70"
        >
          <Card className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text variant="muted">Strength trend exercise</Text>
              <Text variant="body">{selectedName ?? 'Pick an exercise'}</Text>
            </View>
            <Icon icon={ChevronDown} size={18} color={colors.fgFaint} />
          </Card>
        </Pressable>
      </ScrollView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) => {
          setPicked({ id: exercise.id, name: exercise.name });
          setPickerOpen(false);
        }}
      />
    </Screen>
  );
}
