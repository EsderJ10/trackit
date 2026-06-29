import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Pencil, Play } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  Icon,
  Screen,
  SectionHeader,
  Text,
  colors,
  glow,
  tint,
} from '@/ui';

import { cellStatus, type CursorStatus, weekStatus } from '../program-roadmap';
import {
  startProgramWorkout,
  useProgram,
  useProgramDays,
  useProgramExercises,
  useProgramWeeks,
} from '../queries';

/**
 * Read-only program roadmap: the first-class destination for the active program.
 * Shows the week timeline, the day split, and a "you are here" cursor with a
 * start-from-here CTA. Editing lives behind the header pencil (ProgramEditor).
 */
export function ProgramRoadmap() {
  const { programId: programParam } = useLocalSearchParams<{
    programId: string;
  }>();
  const programId = Number(programParam);
  const router = useRouter();

  const program = useProgram(programId);
  const { data: days } = useProgramDays(programId);
  const { data: weeks } = useProgramWeeks(programId);
  const { data: exercises } = useProgramExercises(programId);

  // Day → its exercise names (in order) for the per-day preview.
  const previewByDay = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const ex of exercises) {
      const list = map.get(ex.programDayId) ?? [];
      list.push(ex.exerciseName);
      map.set(ex.programDayId, list);
    }
    return map;
  }, [exercises]);

  // weekIndex → deload flag; weeks rows may lag `lengthWeeks`, so default false.
  const deloadByWeek = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const w of weeks) map.set(w.weekIndex, w.isDeload);
    return map;
  }, [weeks]);

  function openEdit() {
    router.push({
      pathname: '/modules/gym/program-edit',
      params: { programId: String(programId) },
    });
  }

  function start() {
    router.push({
      pathname: '/modules/gym/workout',
      params: { sessionId: String(startProgramWorkout(programId)) },
    });
  }

  const editAction = (
    <Pressable
      onPress={openEdit}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Edit program"
      className="active:opacity-70"
    >
      <Icon icon={Pencil} size={20} color={colors.fg} />
    </Pressable>
  );

  if (!program) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Program' }} />
        <EmptyState
          title="Program not found"
          description="This program may have been deleted."
        />
      </Screen>
    );
  }

  const { currentWeek, currentDayIndex, lengthWeeks } = program;
  const cursor = { currentWeek, currentDayIndex };
  const weekNumbers = Array.from({ length: lengthWeeks }, (_, i) => i + 1);

  return (
    <Screen>
      <Stack.Screen
        options={{ title: 'Program', headerRight: () => editAction }}
      />
      <ScrollView contentContainerClassName="gap-5 p-5">
        <View className="gap-1">
          <Text variant="display">{program.name}</Text>
          <Text variant="muted">
            Week {currentWeek} of {lengthWeeks}
          </Text>
        </View>

        <View className="gap-2">
          <SectionHeader>Weeks</SectionHeader>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pr-2"
          >
            {weekNumbers.map((week) => (
              <WeekPill
                key={week}
                week={week}
                status={weekStatus(week, currentWeek)}
                deload={deloadByWeek.get(week) ?? false}
              />
            ))}
          </ScrollView>
        </View>

        <View className="gap-3">
          <SectionHeader>The split</SectionHeader>
          {days.length === 0 ? (
            <Pressable onPress={openEdit} className="active:opacity-90">
              <EmptyState
                title="No days yet"
                description="Tap to add training days and fill them with lifts."
              />
            </Pressable>
          ) : (
            days.map((day) => (
              <DayCard
                key={day.id}
                name={day.name}
                dayIndex={day.dayIndex}
                exerciseNames={previewByDay.get(day.id) ?? []}
                status={cellStatus(currentWeek, day.dayIndex, cursor)}
                onStart={start}
                onSetup={openEdit}
              />
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function WeekPill({
  week,
  status,
  deload,
}: {
  week: number;
  status: CursorStatus;
  deload: boolean;
}) {
  const isCurrent = status === 'current';
  const isDone = status === 'done';
  return (
    <View
      className="min-w-16 items-center rounded-2xl border px-3 py-2"
      style={{
        backgroundColor: isCurrent ? tint(colors.gym, 0.13) : colors.surfaceAlt,
        borderColor: isCurrent ? colors.gym : colors.borderSoft,
        ...(isCurrent ? glow(colors.gym, 0.4) : null),
      }}
    >
      <View className="flex-row items-center gap-1">
        {isDone ? <Icon icon={Check} size={12} color={colors.fgMuted} /> : null}
        <Text
          variant="label"
          style={{ color: isCurrent ? colors.gym : colors.fgMuted }}
        >
          Wk {week}
        </Text>
      </View>
      {deload ? (
        <Text variant="caption" style={{ color: colors.fgFaint }}>
          deload
        </Text>
      ) : null}
    </View>
  );
}

function DayCard({
  name,
  dayIndex,
  exerciseNames,
  status,
  onStart,
  onSetup,
}: {
  name: string;
  dayIndex: number;
  exerciseNames: string[];
  status: CursorStatus;
  onStart: () => void;
  onSetup: () => void;
}) {
  const isCurrent = status === 'current';
  const isDone = status === 'done';
  const ready = exerciseNames.length > 0;
  const preview = exerciseNames.slice(0, 4);
  const extra = exerciseNames.length - preview.length;

  return (
    <View style={isCurrent ? glow(colors.gym, 0.45) : undefined}>
      <Card
        className={isCurrent ? 'gap-3 bg-surface-hi' : 'gap-3'}
        style={isCurrent ? { borderColor: colors.gym } : undefined}
      >
        <View className="flex-row items-center gap-2">
          {isCurrent ? (
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: colors.gym }}
            />
          ) : null}
          {isDone ? (
            <Icon icon={Check} size={14} color={colors.fgMuted} />
          ) : null}
          <Text variant="heading" className="flex-1">
            {name}
          </Text>
          <Text variant="caption" style={{ color: colors.fgFaint }}>
            Day {dayIndex + 1}
          </Text>
        </View>

        {isCurrent ? (
          <Text variant="label" style={{ color: colors.gym }}>
            You are here
          </Text>
        ) : null}

        {preview.length > 0 ? (
          <Text variant="caption">
            {preview.join(' · ')}
            {extra > 0 ? ` +${extra} more` : ''}
          </Text>
        ) : (
          <Text variant="caption" style={{ color: colors.fgFaint }}>
            No exercises yet
          </Text>
        )}

        {isCurrent && ready ? (
          <Button
            label="Start workout"
            size="md"
            leftIcon={<Icon icon={Play} size={16} color={colors.fg} />}
            onPress={onStart}
          />
        ) : isCurrent ? (
          <Button
            label="Finish setup"
            variant="secondary"
            size="md"
            onPress={onSetup}
          />
        ) : null}
      </Card>
    </View>
  );
}
