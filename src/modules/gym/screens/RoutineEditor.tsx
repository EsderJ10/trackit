import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import { Button, EmptyState, Icon, Screen, Text, colors } from '@/ui';

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
    router.back();
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
      <ScrollView contentContainerClassName="gap-4 p-5">
        <View className="gap-1">
          <Text variant="caption" className="uppercase tracking-wider">
            Routine name
          </Text>
          <TextInput
            key={routine?.id ?? 'loading'}
            defaultValue={routine?.name}
            placeholder="Routine name"
            placeholderTextColor={colors.fgFaint}
            onEndEditing={(event) =>
              renameRoutine(routineId, event.nativeEvent.text.trim() || 'Routine')
            }
            className="rounded-xl border border-border bg-surface px-4 py-3 text-lg font-semibold text-fg"
          />
        </View>

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
        <Button label="Delete routine" variant="danger" size="md" onPress={remove} />
      </ScrollView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) => addExerciseToRoutine(routineId, exercise.id)}
      />
    </Screen>
  );
}
