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

import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { ProgramDaySection } from '../components/ProgramDaySection';
import { ProgramWaveEditor } from '../components/ProgramWaveEditor';
import { ProgramWeekSection } from '../components/ProgramWeekSection';
import {
  addProgramDay,
  addProgramExercise,
  addProgramWeek,
  deleteProgram,
  removeProgramDay,
  removeProgramExercise,
  removeProgramWeek,
  reorderProgramExercises,
  renameProgram,
  renameProgramDay,
  renameProgramWeek,
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
  type ProgramSchemeChoice,
} from '../queries';

// Default starting weight (canonical kg) — the user adjusts it per exercise.
const DEFAULT_START_KG = 20;

const SCHEMES: { label: string; scheme: ProgramSchemeChoice; reps?: number }[] =
  [
    {
      label: 'Linear · 3 × 5',
      scheme: {
        type: 'lp',
        incrementKg: 2.5,
        failThreshold: 3,
        deloadPct: 0.1,
      },
      reps: 5,
    },
    {
      label: 'Double · 3 × 8–12',
      scheme: { type: 'dp', incrementKg: 2.5, minReps: 8, maxReps: 12 },
    },
    {
      label: 'Autoregulated · RPE wave',
      scheme: { type: 'rpe', targetRpe: 8 },
      reps: 8,
    },
  ];

/** The exercise awaiting a scheme choice, tagged with the day it belongs to. */
interface Pending {
  dayId: number;
  exerciseId: number;
  name: string;
}

/** The slot whose periodization wave is being edited. */
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
  const program = useProgram(programId);
  const { data: days } = useProgramDays(programId);
  const { data: weeks } = useProgramWeeks(programId);
  const { data: exercises } = useProgramExercises(programId);
  const { weightUnit } = useSettings();

  // Which day's picker is open, and the exercise awaiting a scheme choice.
  const [pickerDayId, setPickerDayId] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  // The slot whose periodization wave is open in the editor modal.
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

  // Stable so the memoized program-exercise rows don't re-render when an
  // unrelated slot is edited (setWaveTarget is a stable state setter).
  const openWaveEditor = useCallback(
    (programExerciseId: number, name: string) => {
      setWaveTarget({ programExerciseId, name });
    },
    [],
  );

  function chooseScheme(option: (typeof SCHEMES)[number]) {
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
    // Land on the programs list, never back on the now-deleted roadmap.
    router.replace('/modules/gym/programs');
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
            onRemoveWeek={(weekId) => removeProgramWeek(programId, weekId)}
          />

          {days.length === 0 ? (
            <EmptyState
              title="No days"
              description="Add a training day, then fill it with lifts and how each progresses."
            />
          ) : (
            days.map((day) => (
              <ProgramDaySection
                key={day.id}
                day={day}
                exercises={exercisesByDay.get(day.id) ?? []}
                unit={weightUnit}
                onRenameDay={(name) => renameProgramDay(day.id, name)}
                onRemoveDay={() => removeProgramDay(programId, day.id)}
                onAddExercise={() => setPickerDayId(day.id)}
                onSetWeight={setProgramExerciseWeight}
                onSetTrainingMax={setProgramExerciseTrainingMax}
                onSetE1rm={setProgramExerciseE1rm}
                onRemoveExercise={removeProgramExercise}
                onEditWave={openWaveEditor}
                onReorderExercises={reorderProgramExercises}
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
