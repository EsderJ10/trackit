import { useRouter } from 'expo-router';
import { ChevronRight, Dumbbell, Play, Target } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { ModuleWidgetShell } from '@/core/dashboard/ModuleWidgetShell';
import { useSettings } from '@/core/settings/use-settings';
import type { DashboardWidgetProps } from '@/core/types/module';
import { Button, Icon, Stat, Text, colors, glow } from '@/ui';

import { formatWeight } from '../format';
import {
  type ActiveSession,
  type NextProgramWorkout,
  startProgramWorkout,
  useActiveSession,
  useGymStats,
  useNextProgramWorkout,
} from '../queries';
import { sessionLabelLine } from '../session-label';

export function GymDashboardWidget(_props: DashboardWidgetProps) {
  const router = useRouter();
  const stats = useGymStats();
  const active = useActiveSession();
  const next = useNextProgramWorkout();
  const { weightUnit } = useSettings();

  function openWorkout(sessionId: number) {
    router.push({
      pathname: '/modules/gym/workout',
      params: { sessionId: String(sessionId) },
    });
  }

  function openProgram(programId: number) {
    router.push({
      pathname: '/modules/gym/program',
      params: { programId: String(programId) },
    });
  }

  return (
    <ModuleWidgetShell
      title="Gym"
      icon={Dumbbell}
      accent={colors.gym}
      onPress={() => router.navigate('/train')}
    >
      {active ? (
        <ResumeHero session={active} onPress={() => openWorkout(active.id)} />
      ) : next?.ready ? (
        <ReadyProgramHero
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

      <View className="mt-4 flex-row justify-between">
        <Stat
          label="Sets / wk"
          value={String(stats.weeklySets)}
          accent={colors.gym}
        />
        <Stat
          label="Volume / wk"
          value={formatWeight(stats.weeklyVolume, weightUnit)}
          accent={colors.gym}
        />
      </View>
    </ModuleWidgetShell>
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
    <View style={glow(colors.gym, 0.35)}>
      <Button
        size="md"
        label="Resume workout"
        leftIcon={<Icon icon={Play} size={16} color={colors.fg} />}
        onPress={onPress}
      />
      <View className="mt-3 flex-row items-center gap-2">
        <View
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: colors.gym }}
        />
        <Text variant="muted" className="flex-1">
          Workout in progress · {sessionLabelLine(session)}
        </Text>
      </View>
    </View>
  );
}

function ReadyProgramHero({
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
    <View
      className="rounded-2xl border border-border-soft bg-surface-hi p-4"
      style={glow(colors.gym, 0.45)}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${colors.gym}22` }}
        >
          <Icon icon={Play} size={24} color={colors.gym} />
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
        <Text variant="caption" className="mt-3">
          {preview.join(' · ')}
          {extra > 0 ? ` +${extra} more` : ''}
        </Text>
      ) : null}

      <Button
        className="mt-4"
        size="md"
        label={`Start ${next.dayName ?? 'workout'}`}
        leftIcon={<Icon icon={Play} size={16} color={colors.fg} />}
        onPress={onStart}
      />

      <Pressable
        onPress={onOpenProgram}
        accessibilityRole="button"
        accessibilityLabel={`View ${next.programName}`}
        className="mt-3 flex-row items-center gap-1 active:opacity-70"
      >
        <Text variant="caption" style={{ color: colors.fgMuted }}>
          View program
        </Text>
        <Icon icon={ChevronRight} size={14} color={colors.fgFaint} />
      </Pressable>
    </View>
  );
}

function SetupProgramHero({
  next,
  onPress,
}: {
  next: NextProgramWorkout;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Finish setting up ${next.programName}`}
      className="rounded-2xl border border-border-soft bg-surface-hi p-4 active:opacity-80"
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${colors.gym}22` }}
        >
          <Icon icon={Target} size={24} color={colors.gym} />
        </View>
        <View className="flex-1">
          <Text variant="heading">Finish setting up {next.programName}</Text>
          <Text variant="muted" className="mt-1">
            Add exercises to this day to unlock your next workout.
          </Text>
        </View>
        <Icon icon={ChevronRight} size={18} color={colors.fgFaint} />
      </View>
    </Pressable>
  );
}

function ChooseProgramHero({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Choose a program"
      className="rounded-2xl border border-border-soft bg-surface-hi p-4 active:opacity-80"
      style={glow(colors.gym, 0.35)}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${colors.gym}22` }}
        >
          <Icon icon={Target} size={24} color={colors.gym} />
        </View>
        <View className="flex-1">
          <Text variant="heading">Choose a program</Text>
          <Text variant="muted" className="mt-1">
            Pick a plan and your next workout appears here.
          </Text>
        </View>
        <Icon icon={ChevronRight} size={18} color={colors.fgFaint} />
      </View>
    </Pressable>
  );
}
