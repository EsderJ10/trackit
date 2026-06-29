import { Stack, useLocalSearchParams } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import { Card, Icon, LineChart, Screen, Stat, Text, colors } from '@/ui';

import { e1rmTrend as computeE1rmTrend } from '../analytics';
import { MuscleMap } from '../components/MuscleMap';
import { formatEffort } from '../effort';
import { formatRelativeDate, formatWeight } from '../format';
import { computePRs } from '../progression';
import {
  setExerciseFavorite,
  useEffortScale,
  useExercise,
  useExerciseSetHistory,
  type ExerciseHistoryRow,
} from '../queries';

interface SessionBlock {
  sessionId: number;
  finishedAt: Date | null;
  sets: ExerciseHistoryRow[];
}

/** Capitalize an enum value for display (e.g. `compound` → `Compound`). */
function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** A small bordered pill for a single attribute (muscle group, equipment). */
function Chip({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-border-soft bg-surface-alt px-3 py-1">
      <Text variant="caption" className="uppercase tracking-wider">
        {label}
      </Text>
    </View>
  );
}

export function ExerciseDetail() {
  const { exerciseId: param } = useLocalSearchParams<{ exerciseId: string }>();
  const exerciseId = Number(param);

  const exercise = useExercise(exerciseId);
  const { data: history } = useExerciseSetHistory(exerciseId);
  const { weightUnit } = useSettings();
  const effortScale = useEffortScale();

  const prs = useMemo(
    () =>
      computePRs(
        history.map((row) => ({ reps: row.reps, weight: row.weight })),
      ),
    [history],
  );

  // Total reps ever, and the heaviest single-session tonnage (Σ reps×weight).
  const totals = useMemo(() => {
    if (history.length === 0) return null;
    const volumeBySession = new Map<number, number>();
    let totalReps = 0;
    for (const row of history) {
      totalReps += row.reps;
      volumeBySession.set(
        row.sessionId,
        (volumeBySession.get(row.sessionId) ?? 0) + row.reps * row.weight,
      );
    }
    const bestSessionVolumeKg = Math.max(0, ...volumeBySession.values());
    return { totalReps, bestSessionVolumeKg };
  }, [history]);

  // Best estimated 1RM per session, oldest → newest, for the strength trend.
  // Shared with the Progress screen via the pure, unit-tested `analytics`.
  const e1rmTrend = useMemo(
    () =>
      computeE1rmTrend(
        history.map((row) => ({
          sessionId: row.sessionId,
          finishedAt: row.finishedAt?.getTime() ?? 0,
          reps: row.reps,
          weight: row.weight,
        })),
      ),
    [history],
  );

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

  const primaryMuscles = exercise?.primaryMuscles ?? [];
  const secondaryMuscles = exercise?.secondaryMuscles ?? [];
  const cues = exercise?.cues ?? [];
  const mistakes = exercise?.commonMistakes ?? [];
  // Tonnage/1RM only make sense for loaded lifts; cardio/timed kinds skip them.
  const showLoadRecords =
    exercise?.measurementKind === 'weight_reps' ||
    exercise?.measurementKind === 'bodyweight';

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: exercise?.name ?? 'Exercise',
          headerRight: () =>
            exercise ? (
              <Pressable
                hitSlop={12}
                onPress={() =>
                  setExerciseFavorite(exercise.id, !exercise.isFavorite)
                }
                accessibilityRole="button"
                accessibilityLabel={
                  exercise.isFavorite
                    ? 'Remove from favorites'
                    : 'Add to favorites'
                }
              >
                <Icon
                  icon={Star}
                  color={exercise.isFavorite ? colors.gym : colors.fgFaint}
                  fill={exercise.isFavorite ? colors.gym : 'transparent'}
                />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView contentContainerClassName="gap-4 p-5">
        {/* About — what the movement is, what it works */}
        <Card className="gap-4">
          {exercise?.description ? (
            <Text variant="body" className="text-fg-muted">
              {exercise.description}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            {exercise?.muscleGroup ? (
              <Chip label={exercise.muscleGroup} />
            ) : null}
            {exercise?.equipment ? <Chip label={exercise.equipment} /> : null}
            {exercise?.mechanic ? <Chip label={titleCase(exercise.mechanic)} /> : null}
            {exercise?.forceType ? (
              <Chip label={titleCase(exercise.forceType)} />
            ) : null}
          </View>
          {primaryMuscles.length > 0 || secondaryMuscles.length > 0 ? (
            <MuscleMap primary={primaryMuscles} secondary={secondaryMuscles} />
          ) : null}
        </Card>

        {/* How to perform — ordered form cues */}
        {cues.length > 0 ? (
          <Card className="gap-3">
            <Text variant="label">How to perform</Text>
            <View className="gap-2">
              {cues.map((cue, index) => (
                <View key={index} className="flex-row gap-3">
                  <Text
                    variant="label"
                    className="w-5"
                    style={{ color: colors.gym }}
                  >
                    {index + 1}
                  </Text>
                  <Text variant="body" className="flex-1">
                    {cue}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Common mistakes — what to avoid */}
        {mistakes.length > 0 ? (
          <Card className="gap-3">
            <Text variant="label">Common mistakes</Text>
            <View className="gap-2">
              {mistakes.map((mistake, index) => (
                <View key={index} className="flex-row gap-3">
                  <Text
                    variant="label"
                    className="w-5"
                    style={{ color: colors.warning }}
                  >
                    ✕
                  </Text>
                  <Text variant="body" className="flex-1">
                    {mistake}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Records */}
        {prs && totals && showLoadRecords ? (
          <Card className="gap-4">
            <Text variant="label">Records</Text>
            <View className="flex-row flex-wrap gap-y-5">
              {prs.heaviestKg > 0 ? (
                <Stat
                  className="w-1/2"
                  label="Heaviest"
                  value={formatWeight(prs.heaviestKg, weightUnit)}
                  accent={colors.gym}
                />
              ) : null}
              {prs.best1RmKg > 0 ? (
                <Stat
                  className="w-1/2"
                  label="Est. 1RM"
                  value={formatWeight(prs.best1RmKg, weightUnit)}
                  accent={colors.gym}
                />
              ) : null}
              {totals.bestSessionVolumeKg > 0 ? (
                <Stat
                  className="w-1/2"
                  label="Best volume"
                  value={formatWeight(totals.bestSessionVolumeKg, weightUnit)}
                  accent={colors.gym}
                />
              ) : null}
              <Stat
                className="w-1/2"
                label="Total reps"
                value={String(totals.totalReps)}
                accent={colors.gym}
              />
            </View>
          </Card>
        ) : null}

        {/* Strength trend */}
        {e1rmTrend.length >= 2 ? (
          <Card className="gap-2">
            <Text variant="label">Est. 1RM trend</Text>
            <LineChart data={e1rmTrend} color={colors.gym} height={120} />
          </Card>
        ) : null}

        {/* Set history */}
        {sessions.length === 0 ? (
          <Text variant="muted" className="px-1">
            No history yet — complete sets of this exercise to track your PRs
            and trends.
          </Text>
        ) : (
          sessions.map((session) => (
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
                      <Text variant="muted">
                        {formatEffort(set.rpe, effortScale)}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
