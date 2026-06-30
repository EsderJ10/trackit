import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';

import { useSettings } from '@/core/settings/use-settings';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Screen,
  Text,
  TextField,
  colors,
} from '@/ui';

import { SCHEME_PRESETS, type SchemePreset } from '../program-schemes';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { ProgramDaySection } from '../components/ProgramDaySection';
import { ProgramWaveEditor } from '../components/ProgramWaveEditor';
import { ProgramWeekSection } from '../components/ProgramWeekSection';
import {
  addProgramDay,
  addProgramExercise,
  addProgramWeek,
  deleteProgram,
  duplicateProgramDay,
  duplicateProgramWeek,
  removeProgramDay,
  removeProgramExercise,
  removeProgramWeek,
  reorderProgramDays,
  reorderProgramExercises,
  reorderProgramWeeks,
  renameProgram,
  renameProgramDay,
  renameProgramWeek,
  updateProgramExerciseScheme,
  updateProgramSupersets,
  setProgramExerciseE1rm,
  setProgramExerciseTrainingMax,
  setProgramExerciseWeight,
  setProgramWeekDeload,
  startProgramWorkout,
  useProgram,
  useProgramDays,
  useProgramExercises,
  useProgramWeeks,
  type ProgramExerciseRow,
} from '../queries';
import { useWorkoutLauncher } from '../hooks/use-workout-launcher';

// Default starting weight (canonical kg); adjusted per exercise.
const DEFAULT_START_KG = 20;

interface Pending {
  dayId: number;
  exerciseId: number;
  name: string;
}

interface WaveTarget {
  programExerciseId: number;
  name: string;
}

export function ProgramEditor() {
  const { programId: programParam } = useLocalSearchParams<{
    programId: string;
  }>();
  const programId = Number(programParam);
  const router = useRouter();
  const { launch } = useWorkoutLauncher();
  const program = useProgram(programId);
  const { data: days } = useProgramDays(programId);
  const { data: weeks } = useProgramWeeks(programId);
  const { data: exercises } = useProgramExercises(programId);
  const { weightUnit } = useSettings();

  const [pickerDayId, setPickerDayId] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [waveTarget, setWaveTarget] = useState<WaveTarget | null>(null);

  const exercisesByDay = useMemo(() => {
    const map = new Map<number, ProgramExerciseRow[]>();
    for (const row of exercises) {
      const list = map.get(row.programDayId) ?? [];
      list.push(row);
      map.set(row.programDayId, list);
    }
    return map;
  }, [exercises]);

  // Stable so memoized rows don't re-render when an unrelated slot is edited.
  const openWaveEditor = useCallback(
    (programExerciseId: number, name: string) => {
      setWaveTarget({ programExerciseId, name });
    },
    [],
  );

  // Days reorder via up/down buttons (not drag): each day card already hosts a
  // reorderable exercise list, and the library can't nest one inside another.
  function moveDay(from: number, to: number) {
    if (to < 0 || to >= days.length) return;
    const ids = days.map((day) => day.id);
    const [moved] = ids.splice(from, 1);
    if (moved == null) return;
    ids.splice(to, 0, moved);
    reorderProgramDays(ids);
  }

  function chooseScheme(option: SchemePreset) {
    if (pending == null) return;
    addProgramExercise({
      programId,
      programDayId: pending.dayId,
      exerciseId: pending.exerciseId,
      scheme: option.scheme,
      targetSets: 3,
      startingWeightKg: DEFAULT_START_KG,
      startingReps: option.reps,
    });
    setPending(null);
  }

  function remove() {
    deleteProgram(programId);
    // replace, not back: avoid landing on the now-deleted roadmap.
    router.replace('/modules/gym/programs');
  }

  function start() {
    launch(() => startProgramWorkout(programId));
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Edit program' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollViewContainer contentContainerStyle={{ gap: 16, padding: 20 }}>
          <TextField
            key={program?.id ?? 'loading'}
            label="Program name"
            defaultValue={program?.name}
            placeholder="Program name"
            returnKeyType="done"
            onEndEditing={(event) =>
              renameProgram(
                programId,
                event.nativeEvent.text.trim() || 'Program',
              )
            }
          />

          <ProgramWeekSection
            weeks={weeks}
            onAddWeek={() => addProgramWeek(programId)}
            onRenameWeek={renameProgramWeek}
            onToggleDeload={setProgramWeekDeload}
            onDuplicateWeek={(weekId) =>
              duplicateProgramWeek(programId, weekId)
            }
            onRemoveWeek={(weekId) => removeProgramWeek(programId, weekId)}
            onReorderWeeks={(orderedIds) =>
              reorderProgramWeeks(programId, orderedIds)
            }
          />

          {days.length === 0 ? (
            <EmptyState
              title="No days"
              description="Add a training day, then fill it with lifts and how each progresses."
            />
          ) : (
            days.map((day, index) => (
              <ProgramDaySection
                key={day.id}
                day={day}
                exercises={exercisesByDay.get(day.id) ?? []}
                unit={weightUnit}
                onRenameDay={(name) => renameProgramDay(day.id, name)}
                onDuplicateDay={() => duplicateProgramDay(programId, day.id)}
                onRemoveDay={() => removeProgramDay(programId, day.id)}
                onAddExercise={() => setPickerDayId(day.id)}
                onSetWeight={setProgramExerciseWeight}
                onSetTrainingMax={setProgramExerciseTrainingMax}
                onSetE1rm={setProgramExerciseE1rm}
                onRemoveExercise={removeProgramExercise}
                onEditWave={openWaveEditor}
                onChangeScheme={updateProgramExerciseScheme}
                onReorderExercises={reorderProgramExercises}
                onUpdateSupersets={updateProgramSupersets}
                onMoveUp={index > 0 ? () => moveDay(index, index - 1) : null}
                onMoveDown={
                  index < days.length - 1
                    ? () => moveDay(index, index + 1)
                    : null
                }
              />
            ))
          )}

          {pending ? (
            <Card className="gap-3">
              <Text variant="heading">How should {pending.name} progress?</Text>
              {SCHEME_PRESETS.map((option) => (
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
          ) : null}

          <Button
            label="Add day"
            variant="secondary"
            leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
            onPress={() => addProgramDay(programId)}
          />

          <Button label="Start workout" onPress={start} />
          <Button
            label="Delete program"
            variant="danger"
            size="md"
            onPress={remove}
          />
        </ScrollViewContainer>
      </KeyboardAvoidingView>

      <ExercisePickerModal
        visible={pickerDayId != null}
        onClose={() => setPickerDayId(null)}
        onSelect={(exercise) => {
          if (pickerDayId == null) return;
          setPending({
            dayId: pickerDayId,
            exerciseId: exercise.id,
            name: exercise.name,
          });
          setPickerDayId(null);
        }}
      />

      <ProgramWaveEditor
        visible={waveTarget != null}
        onClose={() => setWaveTarget(null)}
        programExerciseId={waveTarget?.programExerciseId ?? null}
        exerciseName={waveTarget?.name ?? ''}
      />
    </Screen>
  );
}
