import { useState } from 'react';

import { Card, Text, TextField } from '@/ui';

export interface SessionNotesFieldProps {
  /** Initial notes for the session (seeded once on mount). */
  initialNotes: string | null;
  onCommit: (notes: string) => void;
}

/**
 * Multiline notes for a workout session. Local state is seeded once and commits
 * on blur, so live-query re-renders don't clobber text mid-edit (same pattern as
 * `SetRow`). Mount this only once the session row has loaded so the seed is real.
 */
export function SessionNotesField({
  initialNotes,
  onCommit,
}: SessionNotesFieldProps) {
  const [notes, setNotes] = useState(initialNotes ?? '');

  return (
    <Card className="gap-2">
      <Text variant="label">Notes</Text>
      <TextField
        value={notes}
        onChangeText={setNotes}
        onEndEditing={() => onCommit(notes)}
        onBlur={() => onCommit(notes)}
        placeholder="How did it go? Energy, pain, tweaks…"
        multiline
        textAlignVertical="top"
        style={{ minHeight: 80 }}
      />
    </Card>
  );
}
