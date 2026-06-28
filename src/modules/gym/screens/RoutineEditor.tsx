import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
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
  useRoutine,
  useRoutineExercises,
} from '../queries';

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
            exercises.map((row) => (
              <RoutineExerciseRow
                key={row.id}
                row={row}
                unit={weightUnit}
                onUpdate={(patch) => updateRoutineExercise(row.id, patch)}
                onRemove={() => removeRoutineExercise(row.id)}
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
