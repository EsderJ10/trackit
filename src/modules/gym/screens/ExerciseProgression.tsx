import { Stack, useLocalSearchParams } from 'expo-router';
import { TrendingUp } from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import {
  Card,
  EmptyState,
  Icon,
  LineChart,
  Screen,
  Stat,
  Text,
  colors,
} from '@/ui';

import { formatRpe, formatWeight, formatRelativeDate } from '../format';
import { computePRs, gatedOneRepMax } from '../progression';
import {
  useExercise,
  useExerciseSetHistory,
  type ExerciseHistoryRow,
} from '../queries';

interface SessionBlock {
  sessionId: number;
  finishedAt: Date | null;
  sets: ExerciseHistoryRow[];
}

export function ExerciseProgression() {
  const { exerciseId: param } = useLocalSearchParams<{ exerciseId: string }>();
  const exerciseId = Number(param);

  const exercise = useExercise(exerciseId);
  const { data: history } = useExerciseSetHistory(exerciseId);
  const { weightUnit } = useSettings();

  const prs = useMemo(
    () =>
      computePRs(
        history.map((row) => ({ reps: row.reps, weight: row.weight })),
      ),
    [history],
  );

  // Best estimated 1RM per session, oldest → newest, for the strength trend.
  const e1rmTrend = useMemo(() => {
    const bySession = new Map<number, number>();
    for (const row of history) {
      // Skip high-rep sets — their 1RM estimate is unreliable (see gatedOneRepMax).
      const estimate = gatedOneRepMax(row.weight, row.reps);
      if (estimate === null) continue;
      bySession.set(
        row.sessionId,
        Math.max(bySession.get(row.sessionId) ?? 0, estimate),
      );
    }
    // `history` is newest-first; reverse the session order for chronology.
    // Drop sessions with no reliable estimate (all sets > 12 reps) rather than
    // plotting a spurious zero that flat-lines the strength trend.
    const order = [...new Set(history.map((row) => row.sessionId))].reverse();
    return order
      .map((id) => bySession.get(id))
      .filter((value): value is number => value !== undefined);
  }, [history]);

  // Group the flat (newest-first) rows back into per-session blocks, preserving
  // the descending date order.
  const sessions = useMemo<SessionBlock[]>(() => {
    const byId = new Map<number, SessionBlock>();
    const order: number[] = [];
    for (const row of history) {
      let block = byId.get(row.sessionId);
      if (!block) {
        block = {
          sessionId: row.sessionId,
          finishedAt: row.finishedAt,
          sets: [],
        };
        byId.set(row.sessionId, block);
        order.push(row.sessionId);
      }
      block.sets.push(row);
    }
    return order.map((id) => byId.get(id)!);
  }, [history]);

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise?.name ?? 'Exercise' }} />
      {sessions.length === 0 ? (
        <EmptyState
          icon={<Icon icon={TrendingUp} size={40} color={colors.fgFaint} />}
          title="No history yet"
          description="Complete sets of this exercise to track your progress and PRs."
        />
      ) : (
        <ScrollView contentContainerClassName="gap-4 p-5">
          {prs ? (
            <Card className="flex-row justify-around">
              <Stat
                label="Heaviest"
                value={formatWeight(prs.heaviestKg, weightUnit)}
                accent={colors.gym}
              />
              <Stat
                label="Est. 1RM"
                value={formatWeight(prs.best1RmKg, weightUnit)}
                accent={colors.gym}
              />
            </Card>
          ) : null}

          {e1rmTrend.length >= 2 ? (
            <Card className="gap-2">
              <Text variant="label">Est. 1RM trend</Text>
              <LineChart data={e1rmTrend} color={colors.gym} height={120} />
            </Card>
          ) : null}

          {sessions.map((session) => (
            <Card key={session.sessionId} className="gap-2">
              <Text variant="muted">
                {session.finishedAt
                  ? formatRelativeDate(session.finishedAt)
                  : ''}
              </Text>
              <View className="gap-1">
                {session.sets.map((set, index) => (
                  <View
                    key={set.setId}
                    className="flex-row items-center gap-3 rounded-xl bg-surface-alt px-3 py-2"
                  >
                    <Text variant="muted" className="w-6">
                      {index + 1}
                    </Text>
                    <Text variant="body" className="flex-1">
                      {set.reps} × {formatWeight(set.weight, weightUnit)}
                    </Text>
                    {set.rpe != null ? (
                      <Text variant="muted">{formatRpe(set.rpe)}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
