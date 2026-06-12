import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { WeightUnit } from '@/core/settings/schema';
import { fromDisplayWeight, toDisplayWeight } from '@/core/settings/units';
import { Card, Icon, Text, colors } from '@/ui';

import type { RoutineExerciseRow as RoutineExerciseRowData } from '../queries';
import { NumberField } from './NumberField';

export interface RoutineExerciseRowProps {
  row: RoutineExerciseRowData;
  unit: WeightUnit;
  onUpdate: (patch: {
    targetSets?: number;
    targetReps?: number;
    targetWeight?: number | null;
  }) => void;
  onRemove: () => void;
}

function toInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** Editable routine-template row: targets commit on blur. */
export function RoutineExerciseRow({
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

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text variant="heading">{row.exerciseName}</Text>
          <Text variant="caption" className="mt-1 uppercase tracking-wider">
            {row.muscleGroup}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8} className="active:opacity-60">
          <Icon icon={Trash2} size={18} color={colors.fgFaint} />
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        <NumberField
          label="Sets"
          value={sets}
          onChangeText={setSets}
          onEndEditing={() => onUpdate({ targetSets: toInt(sets, row.targetSets) })}
          className="flex-1"
        />
        <NumberField
          label="Reps"
          value={reps}
          onChangeText={setReps}
          onEndEditing={() => onUpdate({ targetReps: toInt(reps, row.targetReps) })}
          className="flex-1"
        />
        <NumberField
          label={`Wt (${unit})`}
          value={weight}
          onChangeText={setWeight}
          onEndEditing={() => {
            const parsed = Number.parseFloat(weight);
            onUpdate({
              targetWeight: Number.isNaN(parsed)
                ? null
                : fromDisplayWeight(parsed, unit),
            });
          }}
          className="flex-1"
        />
      </View>
    </Card>
  );
}
