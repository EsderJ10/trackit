import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarClock, ChevronRight } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import { Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

import { formatEffort } from '../effort';
import { formatWeight } from '../format';
import {
  useEffortScale,
  useSessionSets,
  useSessionSummary,
  type SetLogRow,
} from '../queries';
import { sessionLabel } from '../session-label';

interface ExerciseGroup {
  exerciseId: number;
  name: string;
  sets: SetLogRow[];
}

export function SessionDetail() {
  const { sessionId: sessionParam } = useLocalSearchParams<{
    sessionId: string;
  }>();
  const sessionId = Number(sessionParam);
  const router = useRouter();

  const session = useSessionSummary(sessionId);
  const { data: sets } = useSessionSets(sessionId);
  const { weightUnit } = useSettings();
  const effortScale = useEffortScale();

  // Group the actually-completed sets by exercise, preserving insertion order.
  const groups = useMemo<ExerciseGroup[]>(() => {
    const byId = new Map<number, ExerciseGroup>();
    const order: number[] = [];
    for (const set of sets) {
      if (set.completedAt == null) continue;
      let group = byId.get(set.exerciseId);
      if (!group) {
        group = {
          exerciseId: set.exerciseId,
          name: set.exerciseName,
          sets: [],
        };
        byId.set(set.exerciseId, group);
        order.push(set.exerciseId);
      }
      group.sets.push(set);
    }
    return order.map((id) => byId.get(id)!);
  }, [sets]);

  function openProgression(exerciseId: number) {
    router.push({
      pathname: '/modules/gym/exercise',
      params: { exerciseId: String(exerciseId) },
    });
  }

  function openProgram(programId: number) {
    router.push({
      pathname: '/modules/gym/program',
      params: { programId: String(programId) },
    });
  }

  const label = session
    ? sessionLabel(session)
    : { title: 'Workout', subtitle: undefined };
  const programId = session?.programId ?? null;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Workout' }} />
      <ScrollView contentContainerClassName="gap-4 p-5">
        <View>
          <Text variant="title">{label.title}</Text>
          {label.subtitle ? (
            <Text variant="muted" className="mt-1">
              {label.subtitle}
            </Text>
          ) : null}
          {session?.finishedAt ? (
            <Text variant="muted" className="mt-1">
              {session.finishedAt.toLocaleString()}
            </Text>
          ) : null}
          {programId != null ? (
            <Pressable
              onPress={() => openProgram(programId)}
              accessibilityRole="button"
              accessibilityLabel={`View ${session?.programName ?? 'program'}`}
              className="mt-2 flex-row items-center gap-1 self-start active:opacity-70"
            >
              <Text variant="caption" style={{ color: colors.gym }}>
                View program
              </Text>
              <Icon icon={ChevronRight} size={14} color={colors.gym} />
            </Pressable>
          ) : null}
        </View>

        {session?.notes ? (
          <Card className="gap-1">
            <Text variant="label">Notes</Text>
            <Text variant="body">{session.notes}</Text>
          </Card>
        ) : null}

        {groups.length === 0 ? (
          <EmptyState
            icon={
              <Icon icon={CalendarClock} size={40} color={colors.fgFaint} />
            }
            title="No completed sets"
            description="This workout has no logged sets."
          />
        ) : (
          groups.map((group) => (
            <Card key={group.exerciseId} className="gap-2">
              <Pressable
                onPress={() => openProgression(group.exerciseId)}
                accessibilityRole="button"
                accessibilityLabel={`View ${group.name} progression`}
                className="active:opacity-70"
              >
                <Text variant="heading">{group.name}</Text>
              </Pressable>
              <View className="gap-1">
                {group.sets.map((set, index) => (
                  <View
                    key={set.id}
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
