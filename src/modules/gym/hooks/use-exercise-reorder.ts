import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';

import { reorderProgramExercises, reorderRoutineExercises } from '../queries';

interface PlanSlot {
  id: number;
  exerciseId: number;
}

interface UseExerciseReorderArgs {
  /** The routine plan rows (empty for a program session). */
  plan: readonly PlanSlot[];
  /** The program-day plan rows (empty for a routine session). */
  programPlan: readonly PlanSlot[];
  /** The session, to route a persisted reorder to the right table. */
  session:
    | { routineId: number | null; programDayId: number | null }
    | undefined;
  /** Exercise ids dropped from the session (removed or swapped out) — excluded
      from the plan so they neither trip the "save order?" prompt nor persist. */
  removedIds?: readonly number[];
}

/**
 * Session-local exercise reordering for the active workout: the drag order (by
 * exerciseId, null until first drag) overrides plan order for this workout only;
 * the saved routine/program is touched only on `persistPlanOrder`.
 * `planOrderChanged` reports whether a *plan* exercise moved (vs. only ad-hoc
 * extras), gating the "save new order?" prompt.
 */
export function useExerciseReorder({
  plan,
  programPlan,
  session,
  removedIds,
}: UseExerciseReorderArgs) {
  const [orderOverride, setOrderOverride] = useState<number[] | null>(null);

  const applyReorder = useCallback((orderedExerciseIds: number[]) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOrderOverride(orderedExerciseIds);
  }, []);

  // The plan's exercises (routine or program) as {row id, exerciseId} in saved
  // order; ad-hoc extras aren't part of the plan, so they never appear here.
  // Exercises dropped from the session are excluded so a removal/swap doesn't
  // read as a reorder of the surviving plan.
  const planSlots = useMemo<PlanSlot[]>(() => {
    const removed = new Set(removedIds);
    return (plan.length > 0 ? plan : programPlan)
      .filter((row) => !removed.has(row.exerciseId))
      .map((row) => ({ id: row.id, exerciseId: row.exerciseId }));
  }, [plan, programPlan, removedIds]);

  const planSlotsInDisplayOrder = (): PlanSlot[] => {
    if (orderOverride == null) return planSlots;
    const rank = new Map(orderOverride.map((id, index) => [id, index]));
    return [...planSlots].sort(
      (a, b) =>
        (rank.get(a.exerciseId) ?? Number.POSITIVE_INFINITY) -
        (rank.get(b.exerciseId) ?? Number.POSITIVE_INFINITY),
    );
  };

  const planOrderChanged = (): boolean => {
    if (orderOverride == null || planSlots.length === 0) return false;
    const reordered = planSlotsInDisplayOrder();
    return planSlots.some((slot, index) => reordered[index]?.id !== slot.id);
  };

  const persistPlanOrder = (): void => {
    const ids = planSlotsInDisplayOrder().map((slot) => slot.id);
    if (session?.routineId != null) reorderRoutineExercises(ids);
    else if (session?.programDayId != null) reorderProgramExercises(ids);
  };

  return { orderOverride, applyReorder, planOrderChanged, persistPlanOrder };
}
