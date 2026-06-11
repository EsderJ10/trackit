import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import { Button, Icon, Screen, colors } from '@/ui';

import {
  ExerciseSessionCard,
  type ExerciseTarget,
} from '../components/ExerciseSessionCard';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import {
  deleteSetLog,
  finishWorkout,
  logSet,
  useExercises,
  useRoutineExercises,
  useSession,
  useSessionSets,
  type SetLogRow,
} from '../queries';

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

  const [extraIds, setExtraIds] = useState<number[]>([]);
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

  const displayExercises = useMemo<DisplayExercise[]>(() => {
    const list: DisplayExercise[] = [];
    const seen = new Set<number>();
    for (const row of plan) {
      list.push({
        exerciseId: row.exerciseId,
        name: row.exerciseName,
        target: {
          sets: row.targetSets,
          reps: row.targetReps,
          weight: row.targetWeight,
        },
      });
      seen.add(row.exerciseId);
    }
    for (const id of [...setsByExercise.keys(), ...extraIds]) {
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({ exerciseId: id, name: catalogById.get(id)?.name ?? 'Exercise' });
    }
    return list;
  }, [plan, setsByExercise, extraIds, catalogById]);

  function finish() {
    finishWorkout(sessionId);
    router.replace('/modules/gym/history');
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Workout' }} />
      <ScrollView contentContainerClassName="gap-4 p-5">
        {displayExercises.map((exercise) => {
          const exerciseSets = setsByExercise.get(exercise.exerciseId) ?? [];
          return (
            <ExerciseSessionCard
              key={exercise.exerciseId}
              name={exercise.name}
              target={exercise.target}
              sets={exerciseSets}
              unit={weightUnit}
              onLog={(reps, weight) =>
                logSet({
                  sessionId,
                  exerciseId: exercise.exerciseId,
                  setNumber: exerciseSets.length + 1,
                  reps,
                  weight,
                })
              }
              onDeleteSet={deleteSetLog}
            />
          );
        })}

        <Button
          label="Add exercise"
          variant="secondary"
          leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
          onPress={() => setPickerOpen(true)}
        />

        <Button label="Finish workout" onPress={finish} />
      </ScrollView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) =>
          setExtraIds((prev) =>
            prev.includes(exercise.id) ? prev : [...prev, exercise.id],
          )
        }
      />
    </Screen>
  );
}
