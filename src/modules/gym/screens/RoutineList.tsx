import { useRouter } from 'expo-router';
import { Dumbbell, Play, Plus, Target, TrendingUp } from 'lucide-react-native';
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
} from '@/ui';

import { formatRelativeDate } from '../format';
import {
  type ActiveSession,
  createRoutine,
  startWorkout,
  useActiveSession,
  useRoutineExercises,
  useRoutines,
} from '../queries';

export function RoutineList() {
  const router = useRouter();
  const { data: routines } = useRoutines();
  const active = useActiveSession();

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
    <Screen edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-4 p-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <Text variant="display">Train</Text>
          <View className="flex-row gap-2">
            <HeaderAction
              icon={Target}
              label="Programs"
              onPress={() => router.push('/modules/gym/programs')}
            />
            <HeaderAction
              icon={TrendingUp}
              label="Exercises"
              onPress={() => router.push('/modules/gym/exercises')}
            />
          </View>
        </View>

        {active ? (
          <ResumeHero session={active} onPress={() => openWorkout(active.id)} />
        ) : (
          <StartHero onPress={() => openWorkout(startWorkout())} />
        )}

        <SectionHeader
          right={
            <Pressable
              onPress={() => openRoutine(createRoutine('New routine'))}
              hitSlop={8}
              className="flex-row items-center gap-1 active:opacity-70"
            >
              <Icon icon={Plus} size={14} color={colors.primaryBright} />
              <Text variant="label" style={{ color: colors.primaryBright }}>
                New
              </Text>
            </Pressable>
          }
        >
          Routines
        </SectionHeader>

        {routines.length === 0 ? (
          <EmptyState
            icon={<Icon icon={Dumbbell} size={40} color={colors.fgFaint} />}
            title="No routines yet"
            description="Create a routine to plan your workouts, or start an empty session above."
          />
        ) : (
          routines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routineId={routine.id}
              name={routine.name}
              createdAt={routine.createdAt}
              onOpen={() => openRoutine(routine.id)}
              onStart={() => openWorkout(startWorkout(routine.id))}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function HeaderAction({
  icon,
  label,
  onPress,
}: {
  icon: typeof Target;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70"
    >
      <Icon icon={icon} size={18} color={colors.fgMuted} />
    </Pressable>
  );
}

function StartHero({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={glow(colors.gym, 0.5)}
      className="active:opacity-90"
    >
      <Card className="flex-row items-center gap-4 bg-surface-hi">
        <View
          className="h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${colors.gym}22` }}
        >
          <Icon icon={Play} size={26} color={colors.gym} />
        </View>
        <View className="flex-1">
          <Text variant="heading">Start an empty workout</Text>
          <Text variant="muted">Log freestyle, or pick a routine below.</Text>
        </View>
      </Card>
    </Pressable>
  );
}

function ResumeHero({
  session,
  onPress,
}: {
  session: ActiveSession;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={glow(colors.gym, 0.6)}
      className="active:opacity-90"
    >
      <Card className="flex-row items-center gap-4 bg-surface-hi">
        <View
          className="h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${colors.gym}22` }}
        >
          <Icon icon={Play} size={26} color={colors.gym} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: colors.gym }}
            />
            <Text variant="label" style={{ color: colors.gym }}>
              Workout in progress
            </Text>
          </View>
          <Text variant="heading" className="mt-0.5">
            {session.routineName ?? 'Freestyle'}
          </Text>
          <Text variant="muted">Tap to resume where you left off.</Text>
        </View>
      </Card>
    </Pressable>
  );
}

function RoutineCard({
  routineId,
  name,
  createdAt,
  onOpen,
  onStart,
}: {
  routineId: number;
  name: string;
  createdAt: Date;
  onOpen: () => void;
  onStart: () => void;
}) {
  const { data: exercises } = useRoutineExercises(routineId);
  const count = exercises.length;

  return (
    <Card className="gap-3">
      <Pressable onPress={onOpen} className="active:opacity-70">
        <Text variant="heading">{name}</Text>
        <Text variant="caption" className="mt-1">
          {count} {count === 1 ? 'exercise' : 'exercises'} · Created{' '}
          {formatRelativeDate(createdAt)}
        </Text>
      </Pressable>
      <Button
        label="Start workout"
        size="md"
        leftIcon={<Icon icon={Play} size={16} color={colors.fg} />}
        onPress={onStart}
      />
    </Card>
  );
}
