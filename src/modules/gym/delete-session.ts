import { Alert } from 'react-native';

import { deleteSession, sessionProgressionRollbackInfo } from './queries';

/**
 * Confirm, then permanently delete a finished workout (session + its set logs)
 * from history. Because PRs and all stats are live-derived from finished
 * sessions, removing the row also removes its influence on PRs/volume/analytics.
 *
 * For a program session that advanced progression:
 *  - if it's still the latest such session, deleting also reverses that
 *    advancement (cursor + next weights/streaks) — the dialog says so;
 *  - if a later session has since built on it, progression can't be safely
 *    unwound, so the dialog warns it won't roll back (mirrors the edit-mode caveat).
 */
export function confirmDeleteSession(params: {
  sessionId: number;
  title: string;
  onDeleted?: () => void;
}): void {
  const { sessionId, title, onDeleted } = params;
  const { isProgram, willRollback } = sessionProgressionRollbackInfo(sessionId);
  const base = `This permanently removes "${title}" and all its sets from your history, PRs, and stats.`;
  let message = base;
  if (isProgram && willRollback) {
    message = `${base}\n\nYour program's progression (next weights and streaks) will be reverted to before this workout.`;
  } else if (isProgram) {
    message = `${base}\n\nYour program's progression (next weights and streaks) won't be rolled back — a later workout already built on it.`;
  }
  Alert.alert('Delete workout', message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        deleteSession(sessionId);
        onDeleted?.();
      },
    },
  ]);
}
