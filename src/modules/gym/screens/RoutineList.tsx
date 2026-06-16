import { useRouter } from 'expo-router';
import {
  Dumbbell,
  History as HistoryIcon,
  Plus,
  Target,
  TrendingUp,
} from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

import { formatRelativeDate } from '../format';
import { createRoutine, startWorkout, useRoutines } from '../queries';

export function RoutineList() {
  const router = useRouter();
  const { data: routines } = useRoutines();

  function openRoutine(routineId: number) {
    router.push({
      pathname: '/modules/gym/routine',
      params: { routineId: String(routineId) },
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
      <ScrollView contentContainerClassName="gap-4 p-5">
        <View className="flex-row gap-3">
          <Button
            label="New routine"
            className="flex-1"
            leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
            onPress={() => openRoutine(createRoutine('New routine'))}
          />
          <Button
            label="History"
            variant="secondary"
            className="flex-1"
            leftIcon={<Icon icon={HistoryIcon} size={18} color={colors.fg} />}
            onPress={() => router.push('/modules/gym/history')}
          />
        </View>

        <View className="flex-row gap-3">
          <Button
            label="Programs"
            variant="secondary"
            className="flex-1"
            leftIcon={<Icon icon={Target} size={18} color={colors.fg} />}
            onPress={() => router.push('/modules/gym/programs')}
          />
          <Button
            label="Exercises"
            variant="secondary"
            className="flex-1"
            leftIcon={<Icon icon={TrendingUp} size={18} color={colors.fg} />}
            onPress={() => router.push('/modules/gym/exercises')}
          />
        </View>

        {routines.length === 0 ? (
          <EmptyState
            icon={<Icon icon={Dumbbell} size={40} color={colors.fgFaint} />}
            title="No routines yet"
            description="Create a routine to plan your workouts, or start an empty session."
          />
        ) : (
          routines.map((routine) => (
            <Card key={routine.id} className="gap-3">
              <Pressable
                onPress={() => openRoutine(routine.id)}
                className="active:opacity-70"
              >
                <Text variant="heading">{routine.name}</Text>
                <Text variant="caption" className="mt-1">
                  Created {formatRelativeDate(routine.createdAt)}
                </Text>
              </Pressable>
              <Button
                label="Start workout"
                size="md"
                onPress={() => openWorkout(startWorkout(routine.id))}
              />
            </Card>
          ))
        )}

        <Button
          label="Start empty workout"
          variant="ghost"
          onPress={() => openWorkout(startWorkout())}
        />
      </ScrollView>
    </Screen>
  );
}
