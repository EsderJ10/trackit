import { Stack } from 'expo-router';
import { ChevronDown, LineChart as LineChartIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import { toDisplayWeight } from '@/core/settings/units';
import {
  Card,
  Chip,
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
  groupsByVolume,
  seriesPeak,
  seriesTotal,
  weeklySetCount,
  weeklySetsByGroup,
  weeklyTonnage,
} from '../analytics';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { formatWeight } from '../format';
import {
  useExercisePRs,
  useExerciseSetHistory,
  useMuscleLandmarks,
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

// 0 days means all-time.
function rangeFrom(days: number, now: number): number {
  return days === 0 ? 0 : now - days * DAY_MS;
}

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
          <Chip
            key={range.key}
            shape="segment"
            active={active}
            accent={colors.gym}
            onPress={() => onChange(range.key)}
            accessibilityLabel={`Show last ${range.label}`}
          >
            <Text
              style={{
                color: active ? colors.bg : colors.fgMuted,
                fontWeight: '600',
              }}
            >
              {range.label}
            </Text>
          </Chip>
        );
      })}
    </View>
  );
}

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

function GroupChips({
  groups,
  selected,
  onSelect,
}: {
  groups: { group: string; sets: number }[];
  selected: string | null;
  onSelect: (group: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {groups.map(({ group }) => {
        const active = group === selected;
        return (
          <Chip
            key={group}
            active={active}
            accent={colors.gym}
            onPress={() => onSelect(group)}
            accessibilityLabel={`Show ${group} weekly sets`}
          >
            <Text
              style={{
                color: active ? colors.bg : colors.fgMuted,
                fontWeight: '600',
              }}
            >
              {group}
            </Text>
          </Chip>
        );
      })}
    </View>
  );
}

function BandLegend({
  bands,
}: {
  bands: { mev: number; mav: number; mrv: number };
}) {
  const items = [
    { label: 'MEV', value: bands.mev, color: colors.warning },
    { label: 'MAV', value: bands.mav, color: colors.success },
    { label: 'MRV', value: bands.mrv, color: colors.danger },
  ];
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <View key={item.label} className="flex-row items-center gap-1.5">
          <View
            style={{
              width: 14,
              borderTopWidth: 2,
              borderColor: item.color,
              borderStyle: 'dashed',
            }}
          />
          <Text variant="caption">
            {item.label} {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function Progress() {
  const { weightUnit } = useSettings();
  const { data: volume } = useVolumeHistory();
  const landmarks = useMuscleLandmarks();
  const prs = useExercisePRs(1);
  const [rangeKey, setRangeKey] = useState<RangeKey>('12W');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(
    null,
  );
  const [pickedGroup, setPickedGroup] = useState<string | null>(null);

  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];

  // Default the strength chart to the top-PR lift until the user picks another.
  const topPr = prs[0];
  const selectedId = picked?.id ?? topPr?.exerciseId ?? 0;
  const selectedName = picked?.name ?? topPr?.exerciseName ?? null;
  const { data: history } = useExerciseSetHistory(selectedId);

  const volumeTrends = useMemo(() => {
    // Intentional current-time read for the rolling range; recomputes on data/range change.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const from = rangeFrom(range.days, now);
    const sets: VolumeSet[] = volume.map((row) => ({
      finishedAt: row.finishedAt?.getTime() ?? 0,
      reps: row.reps,
      weight: row.weight,
      setType: row.setType,
      measurementKind: row.measurementKind,
      muscleGroup: row.muscleGroup,
    }));
    const tonnage = weeklyTonnage(sets, from, now);
    const setCount = weeklySetCount(sets, from, now);
    return {
      sets,
      from,
      now,
      groups: groupsByVolume(sets, from, now),
      tonnage,
      setCount,
      tonnageTotal: seriesTotal(tonnage),
      tonnagePeak: seriesPeak(tonnage),
      setsTotal: seriesTotal(setCount),
    };
  }, [volume, range.days]);

  const selectedGroup = pickedGroup ?? volumeTrends.groups[0]?.group ?? null;
  const groupSeries = useMemo(
    () =>
      selectedGroup
        ? weeklySetsByGroup(
            volumeTrends.sets,
            selectedGroup,
            volumeTrends.from,
            volumeTrends.now,
          ).map((point) => point.value)
        : [],
    [volumeTrends, selectedGroup],
  );
  const groupBands = selectedGroup ? landmarks.get(selectedGroup) : undefined;
  const groupReferenceLines = groupBands
    ? [
        { value: groupBands.mev, color: colors.warning },
        { value: groupBands.mav, color: colors.success },
        { value: groupBands.mrv, color: colors.danger },
      ]
    : [];

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

        {volumeTrends.groups.length > 0 ? (
          <Card className="gap-3">
            <Text variant="heading">Weekly sets by muscle</Text>
            <GroupChips
              groups={volumeTrends.groups}
              selected={selectedGroup}
              onSelect={setPickedGroup}
            />
            {groupSeries.length >= 2 ? (
              <>
                <LineChart
                  data={groupSeries}
                  color={colors.gym}
                  height={120}
                  referenceLines={groupReferenceLines}
                />
                {groupBands ? <BandLegend bands={groupBands} /> : null}
                <View className="flex-row gap-6">
                  <Stat
                    label="This week"
                    value={`${groupSeries[groupSeries.length - 1] ?? 0} sets`}
                    accent={colors.gym}
                  />
                  <Stat
                    label="Peak week"
                    value={`${Math.max(...groupSeries)} sets`}
                  />
                </View>
              </>
            ) : (
              <Text variant="muted">
                Not enough data yet for {selectedGroup ?? 'this muscle'} — log a
                few more sessions.
              </Text>
            )}
          </Card>
        ) : null}

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
