import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalendarPlus,
  Check,
  Pencil,
  Play,
  TriangleAlert,
} from 'lucide-react-native';
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

import { useWorkoutLauncher } from '../hooks/use-workout-launcher';
import {
  cellKey,
  cellStatus,
  type CursorStatus,
  weekStatus,
} from '../program-roadmap';
import {
  startProgramWorkout,
  startProgramWorkoutFor,
  useProgram,
  useProgramDays,
  useProgramExercises,
  useProgramRoadmap,
  useProgramWeeks,
} from '../queries';

/** Read-only program roadmap: week timeline, day split, "you are here" cursor. */
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
  const roadmap = useProgramRoadmap(programId);
  const { launch } = useWorkoutLauncher();

  const previewByDay = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const ex of exercises) {
      const list = map.get(ex.programDayId) ?? [];
      list.push(ex.exerciseName);
      map.set(ex.programDayId, list);
    }
    return map;
  }, [exercises]);

  // weeks rows may lag `lengthWeeks`, so default missing weeks to non-deload.
  const deloadByWeek = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const w of weeks) map.set(w.weekIndex, w.isDeload);
    return map;
  }, [weeks]);

  // Cells with a logged session this cycle — drives done-vs-skipped status.
  const loggedSet = useMemo(
    () => new Set(roadmap.logged.keys()),
    [roadmap.logged],
  );
  const cursor = {
    currentWeek: roadmap.currentWeek,
    currentDayIndex: roadmap.currentDayIndex,
  };

  // Skipped days in EARLIER weeks (the cursor passed them, never logged). The
  // current week's gaps surface inline in the split below, so skip them here.
  const missed = useMemo(() => {
    const out: { weekIndex: number; dayIndex: number; name: string }[] = [];
    for (let week = 1; week < roadmap.currentWeek; week += 1) {
      for (const day of days) {
        if (!loggedSet.has(cellKey(week, day.dayIndex))) {
          out.push({ weekIndex: week, dayIndex: day.dayIndex, name: day.name });
        }
      }
    }
    return out;
  }, [days, loggedSet, roadmap.currentWeek]);

  function openEdit() {
    router.push({
      pathname: '/modules/gym/program-edit',
      params: { programId: String(programId) },
    });
  }

  // The cursor's own workout (advances the program on finish).
  function startCursor() {
    launch(() => startProgramWorkout(programId));
  }

  // Back-fill a passed/skipped day — recorded without moving the cursor.
  function logDay(weekIndex: number, dayIndex: number) {
    launch(() => startProgramWorkoutFor(programId, weekIndex, dayIndex));
  }

  function viewSession(sessionId: number) {
    router.push({
      pathname: '/modules/gym/session',
      params: { sessionId: String(sessionId) },
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

  const { lengthWeeks } = program;
  const { currentWeek } = roadmap;
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

        {missed.length > 0 ? (
          <View className="gap-2">
            <SectionHeader>Missed workouts</SectionHeader>
            <View
              className="gap-3 rounded-2xl border p-4"
              style={{ borderColor: colors.warning }}
            >
              <View className="flex-row items-center gap-2">
                <Icon icon={TriangleAlert} size={18} color={colors.warning} />
                <Text variant="muted" className="flex-1">
                  {missed.length} scheduled{' '}
                  {missed.length === 1 ? 'day was' : 'days were'} never logged.
                  Log them to keep your progress accurate.
                </Text>
              </View>
              {missed.map((m) => (
                <View
                  key={cellKey(m.weekIndex, m.dayIndex)}
                  className="flex-row items-center gap-3"
                >
                  <View className="flex-1">
                    <Text variant="body">{m.name}</Text>
                    <Text variant="caption" style={{ color: colors.fgFaint }}>
                      Week {m.weekIndex} · Day {m.dayIndex + 1}
                    </Text>
                  </View>
                  <Button
                    label="Log it"
                    size="md"
                    variant="secondary"
                    leftIcon={
                      <Icon icon={CalendarPlus} size={16} color={colors.fg} />
                    }
                    onPress={() => logDay(m.weekIndex, m.dayIndex)}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className="gap-3">
          <SectionHeader>This week</SectionHeader>
          {days.length === 0 ? (
            <Pressable onPress={openEdit} className="active:opacity-90">
              <EmptyState
                title="No days yet"
                description="Tap to add training days and fill them with lifts."
              />
            </Pressable>
          ) : (
            days.map((day) => {
              const status = cellStatus(
                currentWeek,
                day.dayIndex,
                cursor,
                loggedSet,
              );
              const sessionId = roadmap.logged.get(
                cellKey(currentWeek, day.dayIndex),
              );
              return (
                <DayCard
                  key={day.id}
                  name={day.name}
                  dayIndex={day.dayIndex}
                  exerciseNames={previewByDay.get(day.id) ?? []}
                  status={status}
                  onStart={startCursor}
                  onSetup={openEdit}
                  onLog={() => logDay(currentWeek, day.dayIndex)}
                  onView={
                    sessionId != null ? () => viewSession(sessionId) : undefined
                  }
                />
              );
            })
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
  onLog,
  onView,
}: {
  name: string;
  dayIndex: number;
  exerciseNames: string[];
  status: CursorStatus;
  onStart: () => void;
  onSetup: () => void;
  onLog: () => void;
  onView?: () => void;
}) {
  const isCurrent = status === 'current';
  const isDone = status === 'done';
  const isSkipped = status === 'skipped';
  const ready = exerciseNames.length > 0;
  const preview = exerciseNames.slice(0, 4);
  const extra = exerciseNames.length - preview.length;

  const borderColor = isCurrent
    ? colors.gym
    : isSkipped
      ? colors.warning
      : undefined;

  const body = (
    <Card
      className={isCurrent ? 'gap-3 bg-surface-hi' : 'gap-3'}
      style={borderColor ? { borderColor } : undefined}
    >
      <View className="flex-row items-center gap-2">
        {isCurrent ? (
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: colors.gym }}
          />
        ) : null}
        {isDone ? <Icon icon={Check} size={14} color={colors.success} /> : null}
        {isSkipped ? (
          <Icon icon={TriangleAlert} size={14} color={colors.warning} />
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
      ) : isDone ? (
        <Text variant="label" style={{ color: colors.success }}>
          Logged · tap to view
        </Text>
      ) : isSkipped ? (
        <Text variant="label" style={{ color: colors.warning }}>
          Skipped — never logged
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
      ) : isSkipped && ready ? (
        <Button
          label="Log this day"
          variant="secondary"
          size="md"
          leftIcon={<Icon icon={CalendarPlus} size={16} color={colors.fg} />}
          onPress={onLog}
        />
      ) : isSkipped ? (
        <Button
          label="Finish setup"
          variant="secondary"
          size="md"
          onPress={onSetup}
        />
      ) : null}
    </Card>
  );

  // A logged day taps through to its session detail; the cursor day glows.
  if (isDone && onView) {
    return (
      <Pressable
        onPress={onView}
        accessibilityRole="button"
        accessibilityLabel={`View logged ${name}`}
        className="active:opacity-80"
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View style={isCurrent ? glow(colors.gym, 0.45) : undefined}>{body}</View>
  );
}
