import { Plus, Trash2 } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';
import {
  NestedReorderableList,
  type ReorderableListReorderEvent,
  reorderItems,
} from 'react-native-reorderable-list';

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
  onEditWave: (programExerciseId: number, name: string) => void;
  /** Persist a new exercise order for this day (program_exercises row ids). */
  onReorderExercises: (orderedIds: number[]) => void;
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
  onEditWave,
  onReorderExercises,
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
        <Pressable
          onPress={onRemoveDay}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove day"
          className="active:opacity-60"
        >
          <Icon icon={Trash2} size={18} color={colors.fgFaint} />
        </Pressable>
      </View>

      {exercises.length === 0 ? (
        <Text variant="caption">No exercises in this day yet.</Text>
      ) : (
        <NestedReorderableList
          data={exercises}
          scrollable={false}
          keyExtractor={(row) => String(row.id)}
          onReorder={({ from, to }: ReorderableListReorderEvent) =>
            onReorderExercises(
              reorderItems(exercises, from, to).map((row) => row.id),
            )
          }
          renderItem={({ item }) => (
            // The list renders cells flush; a bottom gap restores the day's
            // inter-card spacing (and reads as the drop gap while dragging).
            <View className="pb-3">
              {/* Stable id-based handlers (passed straight through) keep the
                  memoized row from re-rendering when a sibling commits. */}
              <ProgramExerciseRow
                row={item}
                unit={unit}
                reorderable
                onSetWeight={onSetWeight}
                onSetTrainingMax={onSetTrainingMax}
                onSetE1rm={onSetE1rm}
                onRemove={onRemoveExercise}
                onEditWave={onEditWave}
              />
            </View>
          )}
        />
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
