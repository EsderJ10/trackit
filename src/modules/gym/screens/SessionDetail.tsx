import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalendarClock,
  ChevronRight,
  Info,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useSettings } from '@/core/settings/use-settings';
import { Button, Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { ExerciseSessionCard } from '../components/ExerciseSessionCard';
import { SessionNotesField } from '../components/SessionNotesField';
import { confirmDeleteSession } from '../delete-session';
import { formatEffort } from '../effort';
import { formatWeight } from '../format';
import {
  addSet,
  deleteExerciseSets,
  deleteSetLog,
  seedExerciseSets,
  setSetCompleted,
  updateSessionNotes,
  updateSet,
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

  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // View mode shows only completed sets (clean history); edit mode shows every
  // set so a planned/missed one can be filled in and checked off. Both group by
  // exercise in insertion order.
  const groups = useMemo<ExerciseGroup[]>(() => {
    const byId = new Map<number, ExerciseGroup>();
    const order: number[] = [];
    for (const set of sets) {
      if (!editing && set.completedAt == null) continue;
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
  }, [sets, editing]);

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

  function addSetTo(group: ExerciseGroup) {
    const last = group.sets.at(-1);
    addSet({
      sessionId,
      exerciseId: group.exerciseId,
      setNumber: group.sets.length + 1,
      reps: last?.reps ?? 0,
      weight: last?.weight ?? 0,
    });
  }

  function addExercise(exerciseId: number) {
    // Only seed if this exercise isn't already in the session.
    if (!sets.some((s) => s.exerciseId === exerciseId)) {
      seedExerciseSets(sessionId, exerciseId);
    }
  }

  const label = session
    ? sessionLabel(session)
    : { title: 'Workout', subtitle: undefined };
  const programId = session?.programId ?? null;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Workout',
          headerRight: () => (
            <Pressable
              onPress={() => setEditing((e) => !e)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={editing ? 'Done editing' : 'Edit workout'}
              className="active:opacity-70"
            >
              <Text style={{ color: colors.gym, fontWeight: '600' }}>
                {editing ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
          ),
        }}
      />
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

        {editing && programId != null ? (
          <Card className="flex-row items-start gap-2">
            <Icon icon={Info} size={16} color={colors.fgMuted} />
            <Text variant="caption" className="flex-1">
              Progression already advanced from this workout. Editing these sets
              corrects the record but won&apos;t re-run progression.
            </Text>
          </Card>
        ) : null}

        {editing ? (
          <>
            {groups.map((group) => (
              <ExerciseSessionCard
                key={group.exerciseId}
                name={group.name}
                sets={group.sets}
                unit={weightUnit}
                effortScale={effortScale}
                onAddSet={() => addSetTo(group)}
                onUpdateSet={updateSet}
                onToggleSet={setSetCompleted}
                onDeleteSet={deleteSetLog}
                onRemove={() => deleteExerciseSets(sessionId, group.exerciseId)}
                onOpenProgression={() => openProgression(group.exerciseId)}
              />
            ))}
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
            <Button
              label="Delete workout"
              variant="danger"
              leftIcon={<Icon icon={Trash2} size={18} color={colors.bg} />}
              onPress={() =>
                confirmDeleteSession({
                  sessionId,
                  title: label.title,
                  onDeleted: () => router.back(),
                })
              }
            />
          </>
        ) : (
          <>
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
                description="This workout has no logged sets. Tap Edit to add some."
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
          </>
        )}
      </ScrollView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) => addExercise(exercise.id)}
      />
    </Screen>
  );
}
