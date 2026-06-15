import { Stack, useRouter } from 'expo-router';
import { Plus, TrendingUp } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { Button, Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

import {
  createProgram,
  startProgramWorkout,
  useActivePrograms,
  useAllProgramDays,
} from '../queries';

export function ProgramList() {
  const router = useRouter();
  const { data: programs } = useActivePrograms();
  const { data: days } = useAllProgramDays();

  // Group day names by program so each card can show "Next: <day>".
  const daysByProgram = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const day of days) {
      const list = map.get(day.programId) ?? [];
      list.push(day.name);
      map.set(day.programId, list);
    }
    return map;
  }, [days]);

  function openProgram(programId: number) {
    router.push({
      pathname: '/modules/gym/program',
      params: { programId: String(programId) },
    });
  }

  function openWorkout(sessionId: number) {
    router.push({
      pathname: '/modules/gym/workout',
      params: { sessionId: String(sessionId) },
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Programs' }} />
      <ScrollView contentContainerClassName="gap-4 p-5">
        <Button
          label="New program"
          leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
          onPress={() => openProgram(createProgram('New program'))}
        />

        {programs.length === 0 ? (
          <EmptyState
            icon={<Icon icon={TrendingUp} size={40} color={colors.fgFaint} />}
            title="No programs yet"
            description="A program is a multi-week, multi-day roadmap: it suggests your next weights and reps, and walks you through the cycle as you log workouts."
          />
        ) : (
          programs.map((program) => {
            const programDays = daysByProgram.get(program.id) ?? [];
            const dayCount = programDays.length;
            const nextDay = programDays[program.currentDayIndex];
            // Cursor: where the lifter is in the week × day grid.
            const cursor =
              dayCount === 0
                ? 'No days yet'
                : `Week ${program.currentWeek} of ${program.lengthWeeks} · Next: ${
                    nextDay ?? 'Day 1'
                  } (${program.currentDayIndex + 1}/${dayCount})`;

            return (
              <Card key={program.id} className="gap-3">
                <Pressable
                  onPress={() => openProgram(program.id)}
                  className="active:opacity-70"
                >
                  <Text variant="heading">{program.name}</Text>
                  {program.description ? (
                    <Text variant="caption" className="mt-1">
                      {program.description}
                    </Text>
                  ) : null}
                  <Text
                    variant="caption"
                    className="mt-2"
                    style={{ color: colors.primaryBright }}
                  >
                    {cursor}
                  </Text>
                </Pressable>
                <Button
                  label="Start workout"
                  size="md"
                  onPress={() => openWorkout(startProgramWorkout(program.id))}
                />
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
