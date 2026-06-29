import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import {
  ChevronRight,
  Download,
  Minus,
  Plus,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button, Card, Icon, Text, colors, tint } from '@/ui';

import { toWorkoutCsv } from '../csv-export';
import { type EffortScale, effortLabel } from '../effort';
import { formatRestSeconds } from '../format';
import {
  getWorkoutCsvRows,
  setDefaultRestSec,
  setEffortScale,
  setWeeklyGoal,
  useDefaultRestSec,
  useEffortScale,
  useWeeklyGoal,
} from '../queries';

const MIN_GOAL = 1;
const MAX_GOAL = 14;

const MIN_REST = 30;
const MAX_REST = 300;
const REST_STEP = 15;

function StepButton({
  icon,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  icon: LucideIcon;
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-9 w-9 items-center justify-center rounded-xl bg-surface-hi"
      style={disabled ? { opacity: 0.4 } : undefined}
    >
      <Icon icon={icon} size={18} color={colors.fg} />
    </Pressable>
  );
}

function StepperRow({
  title,
  subtitle,
  value,
  onDec,
  onInc,
  canDec,
  canInc,
}: {
  title: string;
  subtitle: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
  canDec: boolean;
  canInc: boolean;
}) {
  return (
    <Card className="flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text variant="body">{title}</Text>
        <Text variant="muted">{subtitle}</Text>
      </View>
      <View className="flex-row items-center gap-3">
        <StepButton
          icon={Minus}
          onPress={onDec}
          disabled={!canDec}
          accessibilityLabel={`Decrease ${title}`}
        />
        <Text variant="heading" className="min-w-12 text-center">
          {value}
        </Text>
        <StepButton
          icon={Plus}
          onPress={onInc}
          disabled={!canInc}
          accessibilityLabel={`Increase ${title}`}
        />
      </View>
    </Card>
  );
}

const EFFORT_SCALES: readonly EffortScale[] = ['rpe', 'rir'];

/** Two-option segmented control choosing how sets surface effort (RPE vs RIR). */
function EffortScaleRow({
  scale,
  onChange,
}: {
  scale: EffortScale;
  onChange: (next: EffortScale) => void;
}) {
  return (
    <Card className="flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text variant="body">Effort scale</Text>
        <Text variant="muted">RPE (1–10) or RIR (reps in reserve)</Text>
      </View>
      <View className="flex-row gap-1 rounded-xl bg-surface-hi p-1">
        {EFFORT_SCALES.map((option) => {
          const active = scale === option;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Use ${effortLabel(option)} scale`}
              className="rounded-lg px-3 py-1.5 active:opacity-70"
              style={active ? { backgroundColor: colors.gym } : undefined}
            >
              <Text
                style={{
                  color: active ? colors.bg : colors.fgMuted,
                  fontWeight: '600',
                }}
              >
                {effortLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/** Gym preferences slotted into the core Settings screen. */
export function GymSettingsPanel() {
  const router = useRouter();
  const goal = useWeeklyGoal();
  const rest = useDefaultRestSec();
  const effortScale = useEffortScale();
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      const rows = getWorkoutCsvRows();
      if (rows.length === 0) {
        Alert.alert('Nothing to export', 'Log a workout first.');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `trackit-workouts-${stamp}.csv`);
      if (file.exists) file.delete();
      file.create();
      file.write(toWorkoutCsv(rows));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export workout history',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('CSV saved', file.uri);
      }
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <View className="gap-3">
      <StepperRow
        title="Weekly workout goal"
        subtitle="Target sessions per week"
        value={String(goal)}
        onDec={() => setWeeklyGoal(Math.max(MIN_GOAL, goal - 1))}
        onInc={() => setWeeklyGoal(Math.min(MAX_GOAL, goal + 1))}
        canDec={goal > MIN_GOAL}
        canInc={goal < MAX_GOAL}
      />

      <StepperRow
        title="Default rest timer"
        subtitle="Auto-starts after each set"
        value={formatRestSeconds(rest)}
        onDec={() => setDefaultRestSec(Math.max(MIN_REST, rest - REST_STEP))}
        onInc={() => setDefaultRestSec(Math.min(MAX_REST, rest + REST_STEP))}
        canDec={rest > MIN_REST}
        canInc={rest < MAX_REST}
      />

      <EffortScaleRow scale={effortScale} onChange={setEffortScale} />

      <Pressable
        onPress={() => router.push('/modules/gym/landmarks')}
        accessibilityRole="button"
        accessibilityLabel="Volume landmarks"
        className="active:opacity-70"
      >
        <Card className="flex-row items-center gap-3">
          <View
            className="h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: tint(colors.gym, 0.15) }}
          >
            <Icon icon={SlidersHorizontal} size={18} color={colors.gym} />
          </View>
          <View className="flex-1">
            <Text variant="body">Volume landmarks</Text>
            <Text variant="muted">Tune your MEV · MAV · MRV per muscle</Text>
          </View>
          <Icon icon={ChevronRight} size={18} color={colors.fgFaint} />
        </Card>
      </Pressable>

      <Button
        label="Export workout history (CSV)"
        variant="secondary"
        size="md"
        loading={exporting}
        disabled={exporting}
        leftIcon={<Icon icon={Download} size={18} color={colors.fg} />}
        onPress={() => {
          void exportCsv();
        }}
      />
    </View>
  );
}
