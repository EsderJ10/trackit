import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView } from 'react-native';

import { fromDisplayWeight, toDisplayWeight } from '@/core/settings/units';
import { useSettings } from '@/core/settings/use-settings';
import { Button, Icon, Screen, colors } from '@/ui';

import {
  ExerciseSessionCard,
  type ExerciseTarget,
} from '../components/ExerciseSessionCard';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { PlateCalculatorModal } from '../components/PlateCalculatorModal';
import { PRBanner } from '../components/PRBanner';
import { RestTimerBar } from '../components/RestTimerBar';
import { SessionNotesField } from '../components/SessionNotesField';
import { DEFAULT_BAR } from '../plate-math';
import { warmupSets } from '../warmup';
import {
  detectPRs,
  type ExerciseBests,
  foldBests,
  prMessage,
} from '../pr-detect';
import {
  addSet,
  addWarmupSets,
  deleteExerciseSets,
  deleteSetLog,
  finishWorkout,
  getDefaultRestSec,
  getExerciseBests,
  getLastPerformance,
  seedExerciseSets,
  setSetCompleted,
  updateSessionNotes,
  updateSet,
  useExercises,
  useProgramDayExercises,
  useRoutineExercises,
  useSession,
  useSessionSets,
  type SetLogRow,
} from '../queries';
import {
  configureRestNotifications,
  ensureRestPermissions,
} from '../rest-notifications';
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
  // 0 never matches an autoincrement id, so these yield no rows when the session
  // isn't routine- / program-based. A session is one or the other, never both.
  const { data: plan } = useRoutineExercises(session?.routineId ?? 0);
  const { data: programPlan } = useProgramDayExercises(
    session?.programDayId ?? 0,
  );
  const { data: sets } = useSessionSets(sessionId);
  const { data: catalog } = useExercises();
  const { weightUnit } = useSettings();
  const startRest = useRestTimer((state) => state.start);
  const stopRest = useRestTimer((state) => state.stop);
  const setRestDuration = useRestTimer((state) => state.setDuration);

  // Set up the rest-timer notification channel/handler, request permission once
  // (contextually, on entering a workout), and hydrate the timer's default
  // length from the persisted setting.
  useEffect(() => {
    configureRestNotifications();
    void ensureRestPermissions();
    setRestDuration(getDefaultRestSec() * 1000);
  }, [setRestDuration]);

  const [extraIds, setExtraIds] = useState<number[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Live PR celebration: the current banner message (cleared on a timer) and the
  // per-exercise all-time bests, fetched lazily and folded as sets complete.
  const [prMsg, setPrMsg] = useState<string | null>(null);
  const bestsRef = useRef(new Map<number, ExerciseBests>());
  // Plate calculator target, in the display unit (null = closed).
  const [plateTarget, setPlateTarget] = useState<number | null>(null);

  useEffect(() => {
    if (prMsg == null) return;
    const timer = setTimeout(() => setPrMsg(null), 2800);
    return () => clearTimeout(timer);
  }, [prMsg]);

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
    // Float warm-ups to the top of each exercise (stable within each group), so a
    // warm-up generated after the working sets still reads as the ramp-up.
    for (const list of map.values()) {
      list.sort((a, b) => {
        const aw = a.setType === 'warmup' ? 0 : 1;
        const bw = b.setType === 'warmup' ? 0 : 1;
        return aw - bw || a.id - b.id;
      });
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
    for (const row of programPlan) {
      // lp/dp have a single working weight worth summarising; percent/rpe carry
      // their load per set (already pre-filled), so a one-line target would be
      // misleading — let the set rows speak instead.
      if (row.schemeType === 'lp' || row.schemeType === 'dp') {
        map.set(row.exerciseId, {
          sets: row.targetSets,
          reps: row.currentReps,
          weight: row.currentWeightKg,
        });
      }
    }
    return map;
  }, [plan, programPlan]);

  // The working weight to seed plate/warm-up tools: the heaviest working set, or
  // the exercise's target, in canonical kg.
  function workWeightKg(exerciseId: number): number {
    const logged = setsByExercise.get(exerciseId) ?? [];
    const heaviest = logged
      .filter((s) => s.setType === 'working')
      .reduce((m, s) => Math.max(m, s.weight), 0);
    if (heaviest > 0) return heaviest;
    return targetByExercise.get(exerciseId)?.weight ?? 0;
  }

  function addWarmup(exerciseId: number) {
    const barKg = fromDisplayWeight(DEFAULT_BAR[weightUnit], weightUnit);
    addWarmupSets(sessionId, exerciseId, warmupSets(workWeightKg(exerciseId), barKg));
  }

  // Program suggestion rationale, surfaced under each exercise's target.
  const reasonByExercise = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of programPlan) {
      if (row.lastReason) map.set(row.exerciseId, row.lastReason);
    }
    return map;
  }, [programPlan]);

  const displayExercises = useMemo<DisplayExercise[]>(() => {
    const removed = new Set(removedIds);
    const list: DisplayExercise[] = [];
    const seen = new Set<number>();
    for (const row of [...plan, ...programPlan]) {
      if (removed.has(row.exerciseId) || seen.has(row.exerciseId)) continue;
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
    programPlan,
    setsByExercise,
    extraIds,
    removedIds,
    targetByExercise,
    catalogById,
  ]);

  // Last session's sets per exercise, to show "prev 5 × 80 kg" + a beat-it cue
  // beside each input. Prior finished sessions don't change mid-workout, so this
  // is a plain (non-reactive) read keyed on the exercise set, not the live sets.
  const exerciseIdsKey = displayExercises
    .map((exercise) => exercise.exerciseId)
    .join(',');
  const previousByExercise = useMemo(() => {
    const map = new Map<number, { reps: number; weight: number }[]>();
    for (const exercise of displayExercises) {
      const prev = getLastPerformance(exercise.exerciseId, sessionId);
      if (prev.length > 0) map.set(exercise.exerciseId, prev);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIdsKey, sessionId]);

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
    // Clear any in-flight rest so its "rest over" notification can't fire after
    // the workout's done (common path: complete last set → tap Finish).
    stopRest();
    finishWorkout(sessionId);
    // Cross-navigator hop: collapse the gym stack and select the History tab.
    // `navigate` pops back to the existing tab (and drops the finished workout
    // from the back stack) — `replace`/`push` would mis-stack across navigators.
    router.navigate('/history');
  }

  function openProgression(exerciseId: number) {
    router.push({
      pathname: '/modules/gym/exercise',
      params: { exerciseId: String(exerciseId) },
    });
  }

  function toggleSet(id: number, completed: boolean) {
    setSetCompleted(id, completed);
    if (!completed) return;
    // Checking off a set kicks off the between-sets rest countdown + a tap.
    startRest();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Live PR check — working sets only; warmups/drops/timed-vs-load never PR.
    const set = sets.find((s) => s.id === id);
    if (set == null || set.setType !== 'working') return;
    const candidate = {
      reps: set.reps,
      weightKg: set.weight,
      durationSec: set.durationSec,
      measurementKind: set.measurementKind,
    };
    let bests = bestsRef.current.get(set.exerciseId);
    if (bests == null) {
      bests = getExerciseBests(set.exerciseId);
    }
    const kinds = detectPRs(candidate, bests);
    // Fold the set in so the same record can't re-fire on a repeat tap.
    bestsRef.current.set(set.exerciseId, foldBests(bests, candidate));
    if (kinds.length > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPrMsg(prMessage(set.exerciseName, kinds));
    }
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
            reason={reasonByExercise.get(exercise.exerciseId)}
            sets={setsByExercise.get(exercise.exerciseId) ?? []}
            previous={previousByExercise.get(exercise.exerciseId)}
            unit={weightUnit}
            onAddSet={() => addSetTo(exercise.exerciseId)}
            onUpdateSet={updateSet}
            onToggleSet={toggleSet}
            onDeleteSet={deleteSetLog}
            onRemove={() => removeExercise(exercise.exerciseId)}
            onOpenProgression={() => openProgression(exercise.exerciseId)}
            onAddWarmup={() => addWarmup(exercise.exerciseId)}
            onShowPlates={() =>
              setPlateTarget(
                toDisplayWeight(workWeightKg(exercise.exerciseId), weightUnit),
              )
            }
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
      <PRBanner message={prMsg} />

      <PlateCalculatorModal
        visible={plateTarget != null}
        onClose={() => setPlateTarget(null)}
        targetDisplay={plateTarget}
        unit={weightUnit}
      />

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) => addExercise(exercise.id)}
      />
    </Screen>
  );
}
