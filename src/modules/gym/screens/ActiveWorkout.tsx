import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import ReorderableList, {
  type ReorderableListReorderEvent,
  reorderItems,
} from 'react-native-reorderable-list';

import { fromDisplayWeight, toDisplayWeight } from '@/core/settings/units';
import { useSettings } from '@/core/settings/use-settings';
import { Button, Icon, Screen, colors } from '@/ui';

import { DragHandle } from '../components/DragHandle';
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
import { supersetBadges } from '../supersets';
import { warmupSets } from '../warmup';
import {
  addSet,
  addWarmupSets,
  deleteExerciseSets,
  deleteSession,
  deleteSetLog,
  finishWorkout,
  getDefaultRestSec,
  getLastPerformance,
  seedExerciseSets,
  setSetCompleted,
  updateSessionNotes,
  updateSet,
  useEffortScale,
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
import { useExerciseReorder } from '../hooks/use-exercise-reorder';
import { usePRCelebration } from '../hooks/use-pr-celebration';

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
  // 0 never matches an autoincrement id; a session is routine- OR program-based.
  const { data: plan } = useRoutineExercises(session?.routineId ?? 0);
  const { data: programPlan } = useProgramDayExercises(
    session?.programDayId ?? 0,
  );
  const { data: sets } = useSessionSets(sessionId);
  const { data: catalog } = useExercises();
  const { weightUnit } = useSettings();
  const effortScale = useEffortScale();
  const startRest = useRestTimer((state) => state.start);
  const stopRest = useRestTimer((state) => state.stop);
  const setRestDuration = useRestTimer((state) => state.setDuration);

  useEffect(() => {
    configureRestNotifications();
    void ensureRestPermissions();
    setRestDuration(getDefaultRestSec() * 1000);
  }, [setRestDuration]);

  const [extraIds, setExtraIds] = useState<number[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  // Drag order overrides plan order session-local; persisted only on confirm.
  const { orderOverride, applyReorder, planOrderChanged, persistPlanOrder } =
    useExerciseReorder({ plan, programPlan, session });
  const [pickerOpen, setPickerOpen] = useState(false);
  const { prMsg, celebrate } = usePRCelebration();
  // Plate calculator target, in the display unit (null = closed).
  const [plateTarget, setPlateTarget] = useState<number | null>(null);

  // Stable toggleSet reads sets from this ref (not a closure) so memoized rows
  // don't all re-render; synced in an effect so the write is commit-safe.
  const setsRef = useRef(sets);
  useEffect(() => {
    setsRef.current = sets;
  }, [sets]);

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
    // Float warm-ups to the top of each exercise so a warm-up added after the
    // working sets still reads as the ramp-up.
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
      // Only lp/dp have a single summarisable working weight; percent/rpe carry
      // per-set load already, so let the set rows speak for those.
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

  // Seed weight (kg) for plate/warm-up tools: heaviest working set, else target.
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
    addWarmupSets(
      sessionId,
      exerciseId,
      warmupSets(workWeightKg(exerciseId), barKg),
    );
  }

  const reasonByExercise = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of programPlan) {
      if (row.lastReason) map.set(row.exerciseId, row.lastReason);
    }
    return map;
  }, [programPlan]);

  // Superset labels (A1, B2, …) by exercise; only one plan is populated.
  const supersetByExercise = useMemo(() => {
    const map = new Map<number, string>();
    const apply = (
      rows: { id: number; exerciseId: number; supersetGroup: number | null }[],
    ) => {
      const badges = supersetBadges(rows);
      for (const row of rows) {
        const badge = badges.get(row.id);
        if (badge) map.set(row.exerciseId, `${badge.letter}${badge.ordinal}`);
      }
    };
    apply(plan);
    apply(programPlan);
    return map;
  }, [plan, programPlan]);

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
    if (orderOverride == null) return list;
    // Apply drag order; exercises added after the last drag fall stably to the end.
    const rank = new Map(orderOverride.map((id, index) => [id, index]));
    return [...list].sort(
      (a, b) =>
        (rank.get(a.exerciseId) ?? Number.POSITIVE_INFINITY) -
        (rank.get(b.exerciseId) ?? Number.POSITIVE_INFINITY),
    );
  }, [
    plan,
    programPlan,
    setsByExercise,
    extraIds,
    removedIds,
    targetByExercise,
    catalogById,
    orderOverride,
  ]);

  // Prior sessions don't change mid-workout, so key on the exercise set, not live sets.
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
    // displayExercises folded into exerciseIdsKey; intentionally non-reactive.
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

  function handleReorder({ from, to }: ReorderableListReorderEvent) {
    applyReorder(
      reorderItems(displayExercises, from, to).map((ex) => ex.exerciseId),
    );
  }

  function commitFinish() {
    // Clear in-flight rest so its "rest over" notification can't fire post-finish.
    stopRest();
    finishWorkout(sessionId);
    // Cross-navigator hop: `navigate` pops back to the History tab; replace/push mis-stack.
    router.navigate('/history');
  }

  // Discard is the non-finishing exit: without it, leaving the screen abandons an
  // unfinished session that lingers forever in the resume bar.
  function discard() {
    Alert.alert(
      'Discard workout?',
      'This deletes this workout and any sets logged in it. This cannot be undone.',
      [
        { text: 'Keep workout', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            stopRest();
            deleteSession(sessionId);
            router.navigate('/train');
          },
        },
      ],
    );
  }

  function finishWithOrderPrompt() {
    if (!planOrderChanged()) {
      commitFinish();
      return;
    }
    const label = session?.routineId != null ? 'routine' : 'program';
    Alert.alert(
      'Save new order?',
      `You reordered exercises this workout. Update your ${label} to match?`,
      [
        { text: 'Keep original', onPress: commitFinish },
        {
          text: 'Update',
          onPress: () => {
            persistPlanOrder();
            commitFinish();
          },
        },
      ],
    );
  }

  function finish() {
    // Warn on unchecked sets before the irreversible finish.
    const incomplete = displayExercises.reduce(
      (n, ex) =>
        n +
        (setsByExercise.get(ex.exerciseId)?.filter((s) => s.completedAt == null)
          .length ?? 0),
      0,
    );
    if (incomplete === 0) {
      finishWithOrderPrompt();
      return;
    }
    Alert.alert(
      'Finish workout?',
      `You have ${incomplete} unfinished ${incomplete === 1 ? 'set' : 'sets'}.`,
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Finish',
          style: 'destructive',
          onPress: finishWithOrderPrompt,
        },
      ],
    );
  }

  function openProgression(exerciseId: number) {
    router.push({
      pathname: '/modules/gym/exercise',
      params: { exerciseId: String(exerciseId) },
    });
  }

  const toggleSet = useCallback(
    (id: number, completed: boolean) => {
      setSetCompleted(id, completed);
      if (!completed) return;
      startRest();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const set = setsRef.current.find((s) => s.id === id);
      if (set != null) celebrate(set);
    },
    [startRest, celebrate],
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Workout',
          headerRight: () => (
            <Pressable
              onPress={discard}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Discard workout"
              className="active:opacity-70"
            >
              <Icon icon={Trash2} size={20} color={colors.danger} />
            </Pressable>
          ),
        }}
      />
      <ReorderableList
        data={displayExercises}
        keyExtractor={(exercise) => String(exercise.exerciseId)}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20 }}
        onReorder={handleReorder}
        renderItem={({ item: exercise }) => (
          // Spacing baked into the cell (not a content gap) so the drag offset math stays exact.
          <View style={{ paddingBottom: 16 }}>
            <ExerciseSessionCard
              name={exercise.name}
              target={exercise.target}
              reason={reasonByExercise.get(exercise.exerciseId)}
              supersetLabel={supersetByExercise.get(exercise.exerciseId)}
              sets={setsByExercise.get(exercise.exerciseId) ?? []}
              previous={previousByExercise.get(exercise.exerciseId)}
              unit={weightUnit}
              effortScale={effortScale}
              dragHandle={<DragHandle />}
              onAddSet={() => addSetTo(exercise.exerciseId)}
              onUpdateSet={updateSet}
              onToggleSet={toggleSet}
              onDeleteSet={deleteSetLog}
              onRemove={() => removeExercise(exercise.exerciseId)}
              onOpenProgression={() => openProgression(exercise.exerciseId)}
              onAddWarmup={() => addWarmup(exercise.exerciseId)}
              onShowPlates={() =>
                setPlateTarget(
                  toDisplayWeight(
                    workWeightKg(exercise.exerciseId),
                    weightUnit,
                  ),
                )
              }
            />
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: 16 }}>
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
          </View>
        }
      />

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
