import { Plus, Trash2 } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';

import type { WeightUnit } from '@/core/settings/schema';
import { Button, Icon, Text, colors } from '@/ui';

import type { ProgramExerciseRow as ProgramExerciseRowData } from '../queries';
import { ProgramExerciseRow } from './ProgramExerciseRow';

export interface ProgramDaySectionProps {
  day: { id: number; name: string };
  exercises: ProgramExerciseRowData[];
  unit: WeightUnit;
  onRenameDay: (name: string) => void;
  onRemoveDay: () => void;
  onAddExercise: () => void;
  onSetWeight: (programExerciseId: number, weightKg: number) => void;
  onSetTrainingMax: (programExerciseId: number, weightKg: number) => void;
  onSetE1rm: (programExerciseId: number, weightKg: number) => void;
  onRemoveExercise: (programExerciseId: number) => void;
}

/** One day of a program: an editable name plus its exercises and an add button. */
export function ProgramDaySection({
  day,
  exercises,
  unit,
  onRenameDay,
  onRemoveDay,
  onAddExercise,
  onSetWeight,
  onSetTrainingMax,
  onSetE1rm,
  onRemoveExercise,
}: ProgramDaySectionProps) {
  return (
    <View className="gap-3 rounded-2xl border border-border-soft bg-surface-alt/40 p-3">
      <View className="flex-row items-center justify-between gap-2">
        <TextInput
          defaultValue={day.name}
          placeholder="Day name"
          placeholderTextColor={colors.fgFaint}
          onEndEditing={(event) => onRenameDay(event.nativeEvent.text)}
          className="flex-1 text-base font-semibold text-fg"
        />
        <Pressable onPress={onRemoveDay} hitSlop={8} className="active:opacity-60">
          <Icon icon={Trash2} size={18} color={colors.fgFaint} />
        </Pressable>
      </View>

      {exercises.length === 0 ? (
        <Text variant="caption">No exercises in this day yet.</Text>
      ) : (
        exercises.map((row) => (
          <ProgramExerciseRow
            key={row.id}
            row={row}
            unit={unit}
            onSetWeight={(kg) => onSetWeight(row.id, kg)}
            onSetTrainingMax={(kg) => onSetTrainingMax(row.id, kg)}
            onSetE1rm={(kg) => onSetE1rm(row.id, kg)}
            onRemove={() => onRemoveExercise(row.id)}
          />
        ))
      )}

      <Button
        label="Add exercise"
        variant="secondary"
        size="md"
        leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
        onPress={onAddExercise}
      />
    </View>
  );
}
