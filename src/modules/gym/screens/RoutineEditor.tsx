import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import { Button, EmptyState, Icon, Screen, TextField, colors } from '@/ui';

import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { RoutineExerciseRow } from '../components/RoutineExerciseRow';
import {
  addExerciseToRoutine,
  deleteRoutine,
  removeRoutineExercise,
  renameRoutine,
  startWorkout,
  updateRoutineExercise,
  updateRoutineSupersets,
  useRoutine,
  useRoutineExercises,
} from '../queries';
import { linkWithPrevious, supersetBadges, unlink } from '../supersets';

export function RoutineEditor() {
  const { routineId: routineParam } = useLocalSearchParams<{
    routineId: string;
  }>();
  const routineId = Number(routineParam);
  const router = useRouter();
  const routine = useRoutine(routineId);
  const { data: exercises } = useRoutineExercises(routineId);
  const { weightUnit } = useSettings();
  const [pickerOpen, setPickerOpen] = useState(false);

  const badges = useMemo(() => supersetBadges(exercises), [exercises]);

  // Read the latest rows from a ref so the link/unlink handlers stay stable
  // (preserving the memoized rows) while still acting on current data.
  const exercisesRef = useRef(exercises);
  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

  const onLink = useCallback((id: number) => {
    const list = exercisesRef.current;
    const index = list.findIndex((row) => row.id === id);
    updateRoutineSupersets(linkWithPrevious(list, index));
  }, []);

  const onUnlink = useCallback((id: number) => {
    updateRoutineSupersets(unlink(exercisesRef.current, id));
  }, []);

  function remove() {
    deleteRoutine(routineId);
    if (router.canGoBack()) router.back();
    else router.replace('/modules/gym');
  }

  function start() {
    const sessionId = startWorkout(routineId);
    router.replace({
      pathname: '/modules/gym/workout',
      params: { sessionId: String(sessionId) },
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Edit routine' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerClassName="gap-4 p-5"
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            key={routine?.id ?? 'loading'}
            label="Routine name"
            defaultValue={routine?.name}
            placeholder="Routine name"
            returnKeyType="done"
            onEndEditing={(event) =>
              renameRoutine(
                routineId,
                event.nativeEvent.text.trim() || 'Routine',
              )
            }
          />

          {exercises.length === 0 ? (
            <EmptyState
              title="No exercises"
              description="Add exercises to build out this routine."
            />
          ) : (
            exercises.map((row, index) => (
              <RoutineExerciseRow
                key={row.id}
                row={row}
                unit={weightUnit}
                supersetBadge={badges.get(row.id)}
                canLink={index > 0}
                onUpdate={updateRoutineExercise}
                onRemove={removeRoutineExercise}
                onLink={onLink}
                onUnlink={onUnlink}
              />
            ))
          )}

          <Button
            label="Add exercise"
            variant="secondary"
            leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
            onPress={() => setPickerOpen(true)}
          />

          <Button label="Start workout" onPress={start} />
          <Button
            label="Delete routine"
            variant="danger"
            size="md"
            onPress={remove}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) => addExerciseToRoutine(routineId, exercise.id)}
      />
    </Screen>
  );
}
