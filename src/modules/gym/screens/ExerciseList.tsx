import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Dumbbell } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

import { useExercises } from '../queries';
import type { Exercise } from '../schema';

interface MuscleGroup {
  name: string;
  exercises: Exercise[];
}

export function ExerciseList() {
  const router = useRouter();
  const { data: exercises } = useExercises();

  // The query already orders by muscle group then name; bucket into sections.
  const groups = useMemo<MuscleGroup[]>(() => {
    const byName = new Map<string, MuscleGroup>();
    const order: string[] = [];
    for (const exercise of exercises) {
      let group = byName.get(exercise.muscleGroup);
      if (!group) {
        group = { name: exercise.muscleGroup, exercises: [] };
        byName.set(exercise.muscleGroup, group);
        order.push(exercise.muscleGroup);
      }
      group.exercises.push(exercise);
    }
    return order.map((name) => byName.get(name)!);
  }, [exercises]);

  function openProgression(exerciseId: number) {
    router.push({
      pathname: '/modules/gym/exercise',
      params: { exerciseId: String(exerciseId) },
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Exercises' }} />
      {exercises.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Dumbbell} size={40} color={colors.fgFaint} />}
          title="No exercises"
          description="Add exercises from a routine or workout to see them here."
        />
      ) : (
        <ScrollView contentContainerClassName="gap-5 p-5">
          {groups.map((group) => (
            <View key={group.name} className="gap-2">
              <Text variant="caption" className="uppercase tracking-wider">
                {group.name}
              </Text>
              {group.exercises.map((exercise) => (
                <Pressable
                  key={exercise.id}
                  onPress={() => openProgression(exercise.id)}
                  className="active:opacity-70"
                >
                  <Card className="flex-row items-center justify-between">
                    <Text variant="body">{exercise.name}</Text>
                    <Icon
                      icon={ChevronRight}
                      size={18}
                      color={colors.fgFaint}
                    />
                  </Card>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
