import { Alert } from 'react-native';

import { deleteSession } from './queries';

/**
 * Confirm, then permanently delete a finished workout (session + its set logs)
 * from history. Because PRs and all stats are live-derived from finished
 * sessions, removing the row also removes its influence on PRs/volume/analytics.
 *
 * Program-linked sessions get an extra warning: finishing one already advanced
 * the program's progression (next weights, streaks), and that advancement is
 * NOT rolled back here — mirroring the edit-mode "won't re-run progression"
 * caveat. `isProgram` is true when the session was logged against a program day.
 */
export function confirmDeleteSession(params: {
  sessionId: number;
  title: string;
  isProgram: boolean;
  onDeleted?: () => void;
}): void {
  const { sessionId, title, isProgram, onDeleted } = params;
  const base = `This permanently removes "${title}" and all its sets from your history, PRs, and stats.`;
  const message = isProgram
    ? `${base}\n\nYour program's progression (next weights and streaks) won't be rolled back.`
    : base;
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
