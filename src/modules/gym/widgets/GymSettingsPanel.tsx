import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Minus,
  Plus,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Card, Icon, Text, colors } from '@/ui';

import {
  setDefaultRestSec,
  setWeeklyGoal,
  useDefaultRestSec,
  useWeeklyGoal,
} from '../queries';

const MIN_GOAL = 1;
const MAX_GOAL = 14;

const MIN_REST = 30;
const MAX_REST = 300;
const REST_STEP = 15;

function StepButton({
  icon,
  onPress,
  disabled,
}: {
  icon: LucideIcon;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      className="h-9 w-9 items-center justify-center rounded-xl bg-surface-hi"
      style={disabled ? { opacity: 0.4 } : undefined}
    >
      <Icon icon={icon} size={18} color={colors.fg} />
    </Pressable>
  );
}

function StepperRow({
  title,
  subtitle,
  value,
  onDec,
  onInc,
  canDec,
  canInc,
}: {
  title: string;
  subtitle: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
  canDec: boolean;
  canInc: boolean;
}) {
  return (
    <Card className="flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text variant="body">{title}</Text>
        <Text variant="muted">{subtitle}</Text>
      </View>
      <View className="flex-row items-center gap-3">
        <StepButton icon={Minus} onPress={onDec} disabled={!canDec} />
        <Text variant="heading" className="min-w-12 text-center">
          {value}
        </Text>
        <StepButton icon={Plus} onPress={onInc} disabled={!canInc} />
      </View>
    </Card>
  );
}

function formatRest(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Gym preferences slotted into the core Settings screen. */
export function GymSettingsPanel() {
  const router = useRouter();
  const goal = useWeeklyGoal();
  const rest = useDefaultRestSec();

  return (
    <View className="gap-3">
      <StepperRow
        title="Weekly workout goal"
        subtitle="Target sessions per week"
        value={String(goal)}
        onDec={() => setWeeklyGoal(Math.max(MIN_GOAL, goal - 1))}
        onInc={() => setWeeklyGoal(Math.min(MAX_GOAL, goal + 1))}
        canDec={goal > MIN_GOAL}
        canInc={goal < MAX_GOAL}
      />

      <StepperRow
        title="Default rest timer"
        subtitle="Auto-starts after each set"
        value={formatRest(rest)}
        onDec={() => setDefaultRestSec(Math.max(MIN_REST, rest - REST_STEP))}
        onInc={() => setDefaultRestSec(Math.min(MAX_REST, rest + REST_STEP))}
        canDec={rest > MIN_REST}
        canInc={rest < MAX_REST}
      />

      <Pressable
        onPress={() => router.push('/modules/gym/landmarks')}
        className="active:opacity-70"
      >
        <Card className="flex-row items-center gap-3">
          <View
            className="h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${colors.gym}26` }}
          >
            <Icon icon={SlidersHorizontal} size={18} color={colors.gym} />
          </View>
          <View className="flex-1">
            <Text variant="body">Volume landmarks</Text>
            <Text variant="muted">Tune your MEV · MAV · MRV per muscle</Text>
          </View>
          <Icon icon={ChevronRight} size={18} color={colors.fgFaint} />
        </Card>
      </Pressable>
    </View>
  );
}
