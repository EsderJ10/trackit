import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  detectPRs,
  type ExerciseBests,
  foldBests,
  prMessage,
} from '../pr-detect';
import { getExerciseBests, type SetLogRow } from '../queries';

/**
 * Live PR celebration for the active workout. Per-exercise bests are fetched
 * lazily on first touch and folded forward as working sets complete, so a record
 * can't re-fire on a repeat tap. Call `celebrate` on check-off; no-ops for non-working sets.
 */
export function usePRCelebration() {
  const [prMsg, setPrMsg] = useState<string | null>(null);
  const bestsRef = useRef(new Map<number, ExerciseBests>());

  useEffect(() => {
    if (prMsg == null) return;
    const timer = setTimeout(() => setPrMsg(null), 2800);
    return () => clearTimeout(timer);
  }, [prMsg]);

  const celebrate = useCallback((set: SetLogRow) => {
    // Working sets only — warmups/drops/timed-vs-load never PR.
    if (set.setType !== 'working') return;
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
    bestsRef.current.set(set.exerciseId, foldBests(bests, candidate));
    if (kinds.length > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPrMsg(prMessage(set.exerciseName, kinds));
    }
  }, []);

  return { prMsg, celebrate };
}
