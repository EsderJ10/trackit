import { Stack, useRouter } from 'expo-router';
import { Plus, TrendingUp } from 'lucide-react-native';
import { Pressable, ScrollView } from 'react-native';

import { Button, Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

import {
  createProgram,
  startProgramWorkout,
  useActivePrograms,
} from '../queries';

export function ProgramList() {
  const router = useRouter();
  const { data: programs } = useActivePrograms();

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
            description="A program suggests your next weights and reps, and advances itself as you log workouts."
          />
        ) : (
          programs.map((program) => (
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
              </Pressable>
              <Button
                label="Start workout"
                size="md"
                onPress={() => openWorkout(startProgramWorkout(program.id))}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
