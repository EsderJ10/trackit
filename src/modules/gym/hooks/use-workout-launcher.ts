import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { deleteSession, getActiveSession } from '../queries';
import { sessionLabelLine } from '../session-label';

export interface WorkoutLauncher {
  /** Jump straight to an existing session's active-workout screen. */
  open: (sessionId: number) => void;
  /**
   * Start a NEW workout via `start` (which returns the new session id). If a
   * workout is already in progress, first ask the user to resume it, discard it,
   * or cancel — so only one workout is ever live at a time.
   */
  launch: (start: () => number) => void;
}

/**
 * Single guarded entry point for starting/resuming workouts. Every "start"
 * affordance (program, routine, empty, back-fill) routes through `launch` so a
 * second session can't be created silently behind an unfinished one.
 */
export function useWorkoutLauncher(): WorkoutLauncher {
  const router = useRouter();

  const open = useCallback(
    (sessionId: number) => {
      router.push({
        pathname: '/modules/gym/workout',
        params: { sessionId: String(sessionId) },
      });
    },
    [router],
  );

  const launch = useCallback(
    (start: () => number) => {
      const active = getActiveSession();
      if (active == null) {
        open(start());
        return;
      }
      Alert.alert(
        'Workout already in progress',
        `You're partway through "${sessionLabelLine(active)}". Finish or discard it before starting another.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Resume it', onPress: () => open(active.id) },
          {
            text: 'Discard & start new',
            style: 'destructive',
            // `start` runs only on confirm, so we never create the new session
            // before the user has chosen to drop the old one.
            onPress: () => {
              deleteSession(active.id);
              open(start());
            },
          },
        ],
      );
    },
    [open],
  );

  return { open, launch };
}
