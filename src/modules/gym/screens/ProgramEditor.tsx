import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import { Button, Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { ProgramExerciseRow } from '../components/ProgramExerciseRow';
import type { ProgressionScheme } from '../progression-engine';
import {
  addProgramExercise,
  deleteProgram,
  removeProgramExercise,
  renameProgram,
  setProgramExerciseWeight,
  startProgramWorkout,
  useProgram,
  useProgramExercises,
} from '../queries';

// Default starting weight (canonical kg) — the user adjusts it per exercise
// before the first session.
const DEFAULT_START_KG = 20;

const SCHEMES: { label: string; scheme: ProgressionScheme; reps?: number }[] = [
  {
    label: 'Linear · 3 × 5',
    scheme: { type: 'lp', incrementKg: 2.5, failThreshold: 3, deloadPct: 0.1 },
    reps: 5,
  },
  {
    label: 'Double · 3 × 8–12',
    scheme: { type: 'dp', incrementKg: 2.5, minReps: 8, maxReps: 12 },
  },
];

export function ProgramEditor() {
  const { programId: programParam } = useLocalSearchParams<{
    programId: string;
  }>();
  const programId = Number(programParam);
  const router = useRouter();
  const program = useProgram(programId);
  const { data: exercises } = useProgramExercises(programId);
  const { weightUnit } = useSettings();

  const [pickerOpen, setPickerOpen] = useState(false);
  // The exercise awaiting a progression-scheme choice before it's added.
  const [pending, setPending] = useState<{ id: number; name: string } | null>(
    null,
  );

  function chooseScheme(option: (typeof SCHEMES)[number]) {
    if (pending == null) return;
    addProgramExercise({
      programId,
      exerciseId: pending.id,
      scheme: option.scheme,
      targetSets: 3,
      startingWeightKg: DEFAULT_START_KG,
      startingReps: option.reps,
    });
    setPending(null);
  }

  function remove() {
    deleteProgram(programId);
    if (router.canGoBack()) router.back();
    else router.replace('/modules/gym/programs');
  }

  function start() {
    const sessionId = startProgramWorkout(programId);
    router.replace({
      pathname: '/modules/gym/workout',
      params: { sessionId: String(sessionId) },
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Edit program' }} />
      <ScrollView contentContainerClassName="gap-4 p-5">
        <View className="gap-1">
          <Text variant="caption" className="uppercase tracking-wider">
            Program name
          </Text>
          <TextInput
            key={program?.id ?? 'loading'}
            defaultValue={program?.name}
            placeholder="Program name"
            placeholderTextColor={colors.fgFaint}
            onEndEditing={(event) =>
              renameProgram(
                programId,
                event.nativeEvent.text.trim() || 'Program',
              )
            }
            className="rounded-xl border border-border bg-surface px-4 py-3 text-lg font-semibold text-fg"
          />
        </View>

        {exercises.length === 0 ? (
          <EmptyState
            title="No exercises"
            description="Add a lift and pick how it should progress."
          />
        ) : (
          exercises.map((row) => (
            <ProgramExerciseRow
              key={row.id}
              row={row}
              unit={weightUnit}
              onSetWeight={(kg) =>
                setProgramExerciseWeight(programId, row.exerciseId, kg)
              }
              onRemove={() => removeProgramExercise(programId, row.exerciseId)}
            />
          ))
        )}

        {pending ? (
          <Card className="gap-3">
            <Text variant="heading">How should {pending.name} progress?</Text>
            {SCHEMES.map((option) => (
              <Button
                key={option.label}
                label={option.label}
                variant="secondary"
                size="md"
                onPress={() => chooseScheme(option)}
              />
            ))}
            <Button
              label="Cancel"
              variant="ghost"
              size="md"
              onPress={() => setPending(null)}
            />
          </Card>
        ) : (
          <Button
            label="Add exercise"
            variant="secondary"
            leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
            onPress={() => setPickerOpen(true)}
          />
        )}

        <Button label="Start workout" onPress={start} />
        <Button
          label="Delete program"
          variant="danger"
          size="md"
          onPress={remove}
        />
      </ScrollView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) =>
          setPending({ id: exercise.id, name: exercise.name })
        }
      />
    </Screen>
  );
}
