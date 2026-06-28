import { Trash2 } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { WeightUnit } from '@/core/settings/schema';
import { fromDisplayWeight, toDisplayWeight } from '@/core/settings/units';
import { Card, Icon, Text, colors, shallowEqual } from '@/ui';

import type { RoutineExerciseRow as RoutineExerciseRowData } from '../queries';
import { NumberField } from './NumberField';

export interface RoutineExerciseRowProps {
  row: RoutineExerciseRowData;
  unit: WeightUnit;
  onUpdate: (
    id: number,
    patch: {
      targetSets?: number;
      targetReps?: number;
      targetWeight?: number | null;
    },
  ) => void;
  onRemove: (id: number) => void;
}

function toInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** Editable routine-template row: targets commit on blur. */
function RoutineExerciseRowComponent({
  row,
  unit,
  onUpdate,
  onRemove,
}: RoutineExerciseRowProps) {
  const [sets, setSets] = useState(String(row.targetSets));
  const [reps, setReps] = useState(String(row.targetReps));
  // Edits in the display unit; targetWeight is stored canonical kg.
  const [weight, setWeight] = useState(
    row.targetWeight != null
      ? String(toDisplayWeight(row.targetWeight, unit))
      : '',
  );
  const weightInvalid =
    weight.trim() !== '' && Number.isNaN(Number.parseFloat(weight));

  function commitSets() {
    const value = toInt(sets, row.targetSets);
    setSets(String(value));
    onUpdate(row.id, { targetSets: value });
  }

  function commitReps() {
    const value = toInt(reps, row.targetReps);
    setReps(String(value));
    onUpdate(row.id, { targetReps: value });
  }

  function commitWeight() {
    const parsed = Number.parseFloat(weight);
    if (Number.isNaN(parsed)) {
      // An empty/invalid field means "no target weight"; reflect that.
      setWeight('');
      onUpdate(row.id, { targetWeight: null });
      return;
    }
    onUpdate(row.id, { targetWeight: fromDisplayWeight(parsed, unit) });
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text variant="heading">{row.exerciseName}</Text>
          <Text variant="caption" className="mt-1 uppercase tracking-wider">
            {row.muscleGroup}
          </Text>
        </View>
        <Pressable
          onPress={() => onRemove(row.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${row.exerciseName}`}
          className="active:opacity-60"
        >
          <Icon icon={Trash2} size={18} color={colors.fgFaint} />
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        <NumberField
          label="Sets"
          value={sets}
          onChangeText={setSets}
          onEndEditing={commitSets}
          accessibilityLabel={`Sets for ${row.exerciseName}`}
          className="flex-1"
        />
        <NumberField
          label="Reps"
          value={reps}
          onChangeText={setReps}
          onEndEditing={commitReps}
          accessibilityLabel={`Reps for ${row.exerciseName}`}
          className="flex-1"
        />
        <NumberField
          label={`Wt (${unit})`}
          value={weight}
          onChangeText={setWeight}
          onEndEditing={commitWeight}
          invalid={weightInvalid}
          accessibilityLabel={`Target weight for ${row.exerciseName}`}
          className="flex-1"
        />
      </View>
    </Card>
  );
}

/** Memoized so editing one routine row leaves its siblings untouched; relies on
    the parent passing stable id-based handlers. */
function propsEqual(
  prev: RoutineExerciseRowProps,
  next: RoutineExerciseRowProps,
): boolean {
  return (
    prev.unit === next.unit &&
    prev.onUpdate === next.onUpdate &&
    prev.onRemove === next.onRemove &&
    shallowEqual(prev.row, next.row)
  );
}

export const RoutineExerciseRow = memo(RoutineExerciseRowComponent, propsEqual);
