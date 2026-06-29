import { Copy, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import {
  NestedReorderableList,
  type ReorderableListReorderEvent,
  reorderItems,
} from 'react-native-reorderable-list';

import type { WeightUnit } from '@/core/settings/schema';
import { Button, Icon, Text, colors } from '@/ui';

import type {
  ProgramExerciseRow as ProgramExerciseRowData,
  ProgramSchemeChoice,
} from '../queries';
import {
  type SupersetUpdate,
  linkWithPrevious,
  supersetBadges,
  unlink,
} from '../supersets';
import { DragHandle } from './DragHandle';
import { ProgramExerciseRow } from './ProgramExerciseRow';

export interface ProgramDaySectionProps {
  day: { id: number; name: string };
  exercises: ProgramExerciseRowData[];
  unit: WeightUnit;
  onRenameDay: (name: string) => void;
  onDuplicateDay: () => void;
  onRemoveDay: () => void;
  onAddExercise: () => void;
  onSetWeight: (programExerciseId: number, weightKg: number) => void;
  onSetTrainingMax: (programExerciseId: number, weightKg: number) => void;
  onSetE1rm: (programExerciseId: number, weightKg: number) => void;
  onRemoveExercise: (programExerciseId: number) => void;
  onEditWave: (programExerciseId: number, name: string) => void;
  /** Switch a slot's progression scheme. */
  onChangeScheme: (programExerciseId: number, scheme: ProgramSchemeChoice) => void;
  /** Persist a new exercise order for this day (program_exercises row ids). */
  onReorderExercises: (orderedIds: number[]) => void;
  /** Persist superset group changes for this day's exercises. */
  onUpdateSupersets: (updates: SupersetUpdate[]) => void;
  /** Render the day's drag grip (only valid inside a reorderable list item). */
  reorderable?: boolean;
}

/** One day of a program: an editable name plus its exercises and an add button. */
export function ProgramDaySection({
  day,
  exercises,
  unit,
  onRenameDay,
  onDuplicateDay,
  onRemoveDay,
  onAddExercise,
  onSetWeight,
  onSetTrainingMax,
  onSetE1rm,
  onRemoveExercise,
  onEditWave,
  onChangeScheme,
  onReorderExercises,
  onUpdateSupersets,
  reorderable,
}: ProgramDaySectionProps) {
  const badges = useMemo(() => supersetBadges(exercises), [exercises]);
  const indexById = useMemo(
    () => new Map(exercises.map((row, index) => [row.id, index])),
    [exercises],
  );

  // Read latest rows from a ref so link/unlink handlers stay stable (preserving
  // the memoized rows) while acting on current data.
  const exercisesRef = useRef(exercises);
  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

  const onLink = useCallback(
    (id: number) => {
      const list = exercisesRef.current;
      const index = list.findIndex((row) => row.id === id);
      onUpdateSupersets(linkWithPrevious(list, index));
    },
    [onUpdateSupersets],
  );
  const onUnlink = useCallback(
    (id: number) => onUpdateSupersets(unlink(exercisesRef.current, id)),
    [onUpdateSupersets],
  );

  return (
    <View className="gap-3 rounded-2xl border border-border-soft bg-surface-alt/40 p-3">
      <View className="flex-row items-center justify-between gap-2">
        {reorderable ? (
          <View className="-ml-1">
            <DragHandle />
          </View>
        ) : null}
        <TextInput
          defaultValue={day.name}
          placeholder="Day name"
          placeholderTextColor={colors.fgFaint}
          onEndEditing={(event) => onRenameDay(event.nativeEvent.text)}
          className="flex-1 text-base font-semibold text-fg"
        />
        <Pressable
          onPress={onDuplicateDay}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Duplicate day"
          className="active:opacity-60"
        >
          <Icon icon={Copy} size={18} color={colors.fgFaint} />
        </Pressable>
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
                supersetBadge={badges.get(item.id)}
                canLink={(indexById.get(item.id) ?? 0) > 0}
                onSetWeight={onSetWeight}
                onSetTrainingMax={onSetTrainingMax}
                onSetE1rm={onSetE1rm}
                onRemove={onRemoveExercise}
                onEditWave={onEditWave}
                onChangeScheme={onChangeScheme}
                onLink={onLink}
                onUnlink={onUnlink}
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
