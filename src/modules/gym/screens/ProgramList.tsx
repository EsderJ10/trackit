import { Stack, useRouter } from 'expo-router';
import { Check, Play, Plus, TrendingUp } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

import {
  createProgram,
  setCurrentProgram,
  startProgramWorkout,
  useActivePrograms,
  useAllProgramDays,
  useCurrentProgram,
} from '../queries';

export function ProgramList() {
  const router = useRouter();
  const { data: programs } = useActivePrograms();
  const { data: days } = useAllProgramDays();
  const current = useCurrentProgram();

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

  // A fresh program has no days/lifts yet — drop straight into the editor.
  function editProgram(programId: number) {
    router.push({
      pathname: '/modules/gym/program-edit',
      params: { programId: String(programId) },
    });
  }

  function openWorkout(sessionId: number) {
    router.push({
      pathname: '/modules/gym/workout',
      params: { sessionId: String(sessionId) },
    });
  }

  // Pick this program to follow, then return to Train where it's now the hero.
  function pickProgram(programId: number) {
    setCurrentProgram(programId);
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Programs' }} />
      <ScrollView contentContainerClassName="gap-4 p-5">
        <Button
          label="New program"
          leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
          onPress={() => editProgram(createProgram('New program'))}
        />

        {programs.length === 0 ? (
          <EmptyState
            icon={<Icon icon={TrendingUp} size={40} color={colors.fgFaint} />}
            title="No programs yet"
            description="A program is a multi-week, multi-day roadmap: choose one to follow and it suggests your next weights and reps, walking you through the cycle as you log workouts."
          />
        ) : (
          programs.map((program) => {
            const programDays = daysByProgram.get(program.id) ?? [];
            const dayCount = programDays.length;
            const nextDay = programDays[program.currentDayIndex];
            const isCurrent = current?.id === program.id;
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
                  <View className="flex-row items-center gap-2">
                    <Text variant="heading" className="flex-1">
                      {program.name}
                    </Text>
                    {isCurrent ? <CurrentBadge /> : null}
                  </View>
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
                {isCurrent ? (
                  <Button
                    label="Start workout"
                    size="md"
                    leftIcon={<Icon icon={Play} size={16} color={colors.fg} />}
                    onPress={() => openWorkout(startProgramWorkout(program.id))}
                  />
                ) : (
                  <Button
                    label="Use this program"
                    variant="secondary"
                    size="md"
                    onPress={() => pickProgram(program.id)}
                  />
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function CurrentBadge() {
  return (
    <View
      className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
      style={{ backgroundColor: `${colors.gym}26` }}
    >
      <Icon icon={Check} size={12} color={colors.gym} />
      <Text variant="caption" style={{ color: colors.gym }}>
        Current
      </Text>
    </View>
  );
}
