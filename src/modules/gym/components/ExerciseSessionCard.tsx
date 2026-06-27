import { Calculator, Flame, Plus, Trash2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Alert, Pressable, View } from 'react-native';

import type { WeightUnit } from '@/core/settings/schema';
import { Button, Card, Icon, Text, colors } from '@/ui';

import { formatWeight } from '../format';
import type { SetLogRow, SetPatch } from '../queries';
import { SetRow } from './SetRow';

export interface ExerciseTarget {
  sets: number;
  reps: number;
  weight: number | null;
}

export interface ExerciseSessionCardProps {
  name: string;
  target?: ExerciseTarget;
  /** Program suggestion rationale ("+2.5 kg — hit all reps"), if any. */
  reason?: string | null;
  sets: SetLogRow[];
  /** Last session's sets for this exercise (canonical kg), aligned by index. */
  previous?: { reps: number; weight: number }[];
  unit: WeightUnit;
  onAddSet: () => void;
  onUpdateSet: (id: number, patch: SetPatch) => void;
  onToggleSet: (id: number, completed: boolean) => void;
  onDeleteSet: (id: number) => void;
  onRemove: () => void;
  /** Tap the exercise name to open its progression view. */
  onOpenProgression?: () => void;
  /** Generate ramp-up warm-up sets (barbell lifts only). */
  onAddWarmup?: () => void;
  /** Open the plate calculator for this exercise's working weight. */
  onShowPlates?: () => void;
  /** Optional drag grip, rendered in the header when reordering is enabled. */
  dragHandle?: ReactNode;
}

/** One exercise inside an active workout: target, editable set rows, controls. */
export function ExerciseSessionCard({
  name,
  target,
  reason,
  sets,
  previous,
  unit,
  onAddSet,
  onUpdateSet,
  onToggleSet,
  onDeleteSet,
  onRemove,
  onOpenProgression,
  onAddWarmup,
  onShowPlates,
  dragHandle,
}: ExerciseSessionCardProps) {
  function confirmRemove() {
    Alert.alert('Remove exercise', `Remove ${name} from this workout?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemove },
    ]);
  }

  // Plate/warm-up tools only make sense for loaded barbell-style lifts.
  const isLoaded = sets[0]?.measurementKind === 'weight_reps';

  // Badge numbers count working sets only (warmups/drops/failures show a letter),
  // so floating warm-ups to the top doesn't renumber the working sets.
  let workingCount = 0;
  const workingNumbers = sets.map((set) =>
    set.setType === 'working' ? ++workingCount : 0,
  );

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-2">
        {dragHandle ? <View className="-ml-1 pt-1">{dragHandle}</View> : null}
        <View className="flex-1">
          <Pressable
            onPress={onOpenProgression}
            disabled={!onOpenProgression}
            className="active:opacity-70"
          >
            <Text variant="heading">{name}</Text>
          </Pressable>
          {target ? (
            <Text variant="muted" className="mt-1">
              Target: {target.sets} × {target.reps}
              {target.weight != null
                ? ` @ ${formatWeight(target.weight, unit)}`
                : ''}
            </Text>
          ) : null}
          {reason ? (
            <Text className="mt-0.5" style={{ color: colors.primaryBright }}>
              {reason}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={confirmRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name}`}
          hitSlop={8}
          className="active:opacity-60"
        >
          <Icon icon={Trash2} size={18} color={colors.fgFaint} />
        </Pressable>
      </View>

      {sets.length > 0 ? (
        <View className="gap-1">
          {sets.map((set, index) => (
            <SetRow
              key={set.id}
              set={set}
              displayNumber={workingNumbers[index] ?? 0}
              unit={unit}
              // Prev cue aligns to the working-set ordinal (history is working
              // sets only) and never shows on a warm-up/drop row.
              previous={
                set.setType === 'working'
                  ? previous?.[(workingNumbers[index] ?? 1) - 1]
                  : undefined
              }
              onUpdate={onUpdateSet}
              onToggle={onToggleSet}
              onDelete={onDeleteSet}
            />
          ))}
        </View>
      ) : null}

      <View className="flex-row gap-2">
        <Button
          label="Set"
          variant="secondary"
          size="md"
          className="flex-1"
          leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
          onPress={onAddSet}
        />
        {isLoaded && onShowPlates ? (
          <Button
            label="Plates"
            variant="ghost"
            size="md"
            leftIcon={
              <Icon icon={Calculator} size={16} color={colors.fgMuted} />
            }
            onPress={onShowPlates}
          />
        ) : null}
        {isLoaded && onAddWarmup ? (
          <Button
            label="Warm-up"
            variant="ghost"
            size="md"
            leftIcon={<Icon icon={Flame} size={16} color={colors.warning} />}
            onPress={onAddWarmup}
          />
        ) : null}
      </View>
    </Card>
  );
}
