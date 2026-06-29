import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Dumbbell,
  Play,
  Plus,
  Route,
  Target,
  TrendingUp,
} from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Button,
  Card,
  Icon,
  PressableCard,
  Screen,
  SectionHeader,
  Text,
  colors,
  glow,
  tint,
} from '@/ui';

import { MuscleVolumeBars } from '../components/MuscleVolumeBars';
import { formatRelativeDate } from '../format';
import {
  type ActiveSession,
  type NextProgramWorkout,
  createRoutine,
  startProgramWorkout,
  startWorkout,
  useActiveSession,
  useGymProfileStats,
  useNextProgramWorkout,
  useRoutineExercises,
  useRoutines,
} from '../queries';
import { sessionLabel } from '../session-label';

export function RoutineList() {
  const router = useRouter();
  const { data: routines } = useRoutines();
  const active = useActiveSession();
  const next = useNextProgramWorkout();
  const { muscleBreakdown } = useGymProfileStats();

  function openRoutine(routineId: number) {
    router.push({
      pathname: '/modules/gym/routine',
      params: { routineId: String(routineId) },
    });
  }

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
    <Screen edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-4 p-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <Text variant="display">Train</Text>
          <View className="flex-row gap-2">
            {next ? (
              <HeaderAction
                icon={Route}
                label="View program"
                onPress={() => openProgram(next.programId)}
              />
            ) : null}
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

        {/* Hero priority: resume an open session → the current program's next
            workout → finish setting it up → pick a program. */}
        {active ? (
          <ResumeHero session={active} onPress={() => openWorkout(active.id)} />
        ) : next?.ready ? (
          <NextWorkoutHero
            next={next}
            onStart={() => openWorkout(startProgramWorkout(next.programId))}
            onOpenProgram={() => openProgram(next.programId)}
          />
        ) : next ? (
          <SetupProgramHero
            next={next}
            onPress={() => openProgram(next.programId)}
          />
        ) : (
          <ChooseProgramHero
            onPress={() => router.push('/modules/gym/programs')}
          />
        )}

        {muscleBreakdown.length > 0 ? (
          <MuscleVolumeBars
            breakdown={muscleBreakdown}
            title="This week's volume"
          />
        ) : null}

        <SectionHeader className="mt-2">Other ways to train</SectionHeader>

        <EmptyWorkoutCard onPress={() => openWorkout(startWorkout())} />

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
          <Card className="flex-row items-center gap-3">
            <Icon icon={Dumbbell} size={20} color={colors.fgFaint} />
            <Text variant="muted" className="flex-1">
              No routines yet — tap New to plan a reusable session.
            </Text>
          </Card>
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

function NextWorkoutHero({
  next,
  onStart,
  onOpenProgram,
}: {
  next: NextProgramWorkout;
  onStart: () => void;
  onOpenProgram: () => void;
}) {
  const preview = next.exerciseNames.slice(0, 4);
  const extra = next.exerciseNames.length - preview.length;

  return (
    <View style={glow(colors.gym, 0.5)}>
      <Card className="gap-4 bg-surface-hi">
        <View className="flex-row items-start gap-4">
          <View
            className="h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: tint(colors.gym, 0.13) }}
          >
            <Icon icon={Play} size={26} color={colors.gym} />
          </View>
          <View className="flex-1">
            <Text variant="label" style={{ color: colors.gym }}>
              {next.isDeload ? 'NEXT · DELOAD' : 'NEXT WORKOUT'}
            </Text>
            <Text variant="heading" className="mt-0.5">
              {next.dayName}
            </Text>
            <Text variant="muted">
              Week {next.weekIndex} of {next.lengthWeeks} · Day{' '}
              {next.dayIndex + 1} of {next.dayCount}
            </Text>
          </View>
        </View>

        {preview.length > 0 ? (
          <Text variant="caption">
            {preview.join(' · ')}
            {extra > 0 ? ` +${extra} more` : ''}
          </Text>
        ) : null}

        <Button
          label="Start workout"
          size="md"
          leftIcon={<Icon icon={Play} size={16} color={colors.fg} />}
          onPress={onStart}
        />

        <Pressable
          onPress={onOpenProgram}
          accessibilityRole="button"
          accessibilityLabel={`View program ${next.programName}`}
          className="flex-row items-center gap-1 active:opacity-70"
        >
          <Text variant="caption" style={{ color: colors.fgMuted }}>
            Following {next.programName}
          </Text>
          <Icon icon={ChevronRight} size={14} color={colors.fgFaint} />
        </Pressable>
      </Card>
    </View>
  );
}

// Current program exists but its cursor day has no exercises yet.
function SetupProgramHero({
  next,
  onPress,
}: {
  next: NextProgramWorkout;
  onPress: () => void;
}) {
  return (
    <PressableCard
      onPress={onPress}
      accessibilityLabel={`Finish setting up ${next.programName}`}
      className="flex-row items-center gap-4"
    >
      <View
        className="h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: tint(colors.gym, 0.13) }}
      >
        <Icon icon={Target} size={26} color={colors.gym} />
      </View>
      <View className="flex-1">
        <Text variant="heading">Finish setting up {next.programName}</Text>
        <Text variant="muted">
          Add exercises to this day to get your next workout.
        </Text>
      </View>
      <Icon icon={ChevronRight} size={18} color={colors.fgFaint} />
    </PressableCard>
  );
}

function ChooseProgramHero({ onPress }: { onPress: () => void }) {
  return (
    <PressableCard
      onPress={onPress}
      accessibilityLabel="Choose a program"
      style={glow(colors.gym, 0.5)}
      className="flex-row items-center gap-4 bg-surface-hi"
    >
      <View
        className="h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: tint(colors.gym, 0.13) }}
      >
        <Icon icon={Target} size={26} color={colors.gym} />
      </View>
      <View className="flex-1">
        <Text variant="heading">Choose a program</Text>
        <Text variant="muted">
          Pick a plan and your next workout shows up right here.
        </Text>
      </View>
      <Icon icon={ChevronRight} size={18} color={colors.fgFaint} />
    </PressableCard>
  );
}

function EmptyWorkoutCard({ onPress }: { onPress: () => void }) {
  return (
    <PressableCard
      onPress={onPress}
      accessibilityLabel="Start an empty workout"
      className="flex-row items-center gap-3"
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: tint(colors.gym, 0.1) }}
      >
        <Icon icon={Play} size={18} color={colors.gym} />
      </View>
      <View className="flex-1">
        <Text variant="body">Start an empty workout</Text>
        <Text variant="muted">Log freestyle, off-plan.</Text>
      </View>
      <Icon icon={ChevronRight} size={18} color={colors.fgFaint} />
    </PressableCard>
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
    <PressableCard
      onPress={onPress}
      accessibilityLabel={`Resume workout: ${sessionLabel(session).title}`}
      style={glow(colors.gym, 0.6)}
      className="flex-row items-center gap-4 bg-surface-hi"
    >
      <View
        className="h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: tint(colors.gym, 0.13) }}
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
          {sessionLabel(session).title}
        </Text>
        <Text variant="muted">
          {sessionLabel(session).subtitle ??
            'Tap to resume where you left off.'}
        </Text>
      </View>
    </PressableCard>
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
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open routine ${name}`}
        className="active:opacity-70"
      >
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
