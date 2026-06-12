import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import { Button, Icon, Screen, colors } from '@/ui';

import {
  ExerciseSessionCard,
  type ExerciseTarget,
} from '../components/ExerciseSessionCard';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { RestTimerBar } from '../components/RestTimerBar';
import { SessionNotesField } from '../components/SessionNotesField';
import {
  addSet,
  deleteExerciseSets,
  deleteSetLog,
  finishWorkout,
  seedExerciseSets,
  setSetCompleted,
  updateSessionNotes,
  updateSet,
  useExercises,
  useRoutineExercises,
  useSession,
  useSessionSets,
  type SetLogRow,
} from '../queries';
import { useRestTimer } from '../rest-timer-store';

interface DisplayExercise {
  exerciseId: number;
  name: string;
  target?: ExerciseTarget;
}

export function ActiveWorkout() {
  const { sessionId: sessionParam } = useLocalSearchParams<{
    sessionId: string;
  }>();
  const sessionId = Number(sessionParam);
  const router = useRouter();

  const session = useSession(sessionId);
  // 0 never matches an autoincrement id, so this yields no rows for freestyle.
  const { data: plan } = useRoutineExercises(session?.routineId ?? 0);
  const { data: sets } = useSessionSets(sessionId);
  const { data: catalog } = useExercises();
  const { weightUnit } = useSettings();
  const startRest = useRestTimer((state) => state.start);

  const [extraIds, setExtraIds] = useState<number[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const catalogById = useMemo(
    () => new Map(catalog.map((exercise) => [exercise.id, exercise])),
    [catalog],
  );

  const setsByExercise = useMemo(() => {
    const map = new Map<number, SetLogRow[]>();
    for (const set of sets) {
      const list = map.get(set.exerciseId) ?? [];
      list.push(set);
      map.set(set.exerciseId, list);
    }
    return map;
  }, [sets]);

  const targetByExercise = useMemo(() => {
    const map = new Map<number, ExerciseTarget>();
    for (const row of plan) {
      map.set(row.exerciseId, {
        sets: row.targetSets,
        reps: row.targetReps,
        weight: row.targetWeight,
      });
    }
    return map;
  }, [plan]);

  const displayExercises = useMemo<DisplayExercise[]>(() => {
    const removed = new Set(removedIds);
    const list: DisplayExercise[] = [];
    const seen = new Set<number>();
    for (const row of plan) {
      if (removed.has(row.exerciseId)) continue;
      list.push({
        exerciseId: row.exerciseId,
        name: row.exerciseName,
        target: targetByExercise.get(row.exerciseId),
      });
      seen.add(row.exerciseId);
    }
    for (const id of [...setsByExercise.keys(), ...extraIds]) {
      if (seen.has(id) || removed.has(id)) continue;
      seen.add(id);
      list.push({
        exerciseId: id,
        name: catalogById.get(id)?.name ?? 'Exercise',
      });
    }
    return list;
  }, [
    plan,
    setsByExercise,
    extraIds,
    removedIds,
    targetByExercise,
    catalogById,
  ]);

  function addSetTo(exerciseId: number) {
    const current = setsByExercise.get(exerciseId) ?? [];
    const last = current.at(-1);
    const target = targetByExercise.get(exerciseId);
    addSet({
      sessionId,
      exerciseId,
      setNumber: current.length + 1,
      reps: last?.reps ?? target?.reps ?? 0,
      weight: last?.weight ?? target?.weight ?? 0,
    });
  }

  function removeExercise(exerciseId: number) {
    deleteExerciseSets(sessionId, exerciseId);
    setExtraIds((prev) => prev.filter((id) => id !== exerciseId));
    setRemovedIds((prev) =>
      prev.includes(exerciseId) ? prev : [...prev, exerciseId],
    );
  }

  function addExercise(exerciseId: number) {
    // Re-adding a previously removed exercise must un-hide it.
    setRemovedIds((prev) => prev.filter((id) => id !== exerciseId));
    setExtraIds((prev) =>
      prev.includes(exerciseId) ? prev : [...prev, exerciseId],
    );
    if ((setsByExercise.get(exerciseId) ?? []).length === 0) {
      seedExerciseSets(sessionId, exerciseId);
    }
  }

  function finish() {
    finishWorkout(sessionId);
    router.replace('/modules/gym/history');
  }

  function openProgression(exerciseId: number) {
    router.push({
      pathname: '/modules/gym/exercise',
      params: { exerciseId: String(exerciseId) },
    });
  }

  function toggleSet(id: number, completed: boolean) {
    setSetCompleted(id, completed);
    // Checking off a set kicks off the between-sets rest countdown.
    if (completed) startRest();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Workout' }} />
      <ScrollView
        contentContainerClassName="gap-4 p-5"
        keyboardShouldPersistTaps="handled"
      >
        {displayExercises.map((exercise) => (
          <ExerciseSessionCard
            key={exercise.exerciseId}
            name={exercise.name}
            target={exercise.target}
            sets={setsByExercise.get(exercise.exerciseId) ?? []}
            unit={weightUnit}
            onAddSet={() => addSetTo(exercise.exerciseId)}
            onUpdateSet={updateSet}
            onToggleSet={toggleSet}
            onDeleteSet={deleteSetLog}
            onRemove={() => removeExercise(exercise.exerciseId)}
            onOpenProgression={() => openProgression(exercise.exerciseId)}
          />
        ))}

        <Button
          label="Add exercise"
          variant="secondary"
          leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
          onPress={() => setPickerOpen(true)}
        />

        {session ? (
          <SessionNotesField
            initialNotes={session.notes}
            onCommit={(notes) => updateSessionNotes(sessionId, notes)}
          />
        ) : null}

        <Button label="Finish workout" onPress={finish} />
      </ScrollView>

      <RestTimerBar />

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) => addExercise(exercise.id)}
      />
    </Screen>
  );
}
