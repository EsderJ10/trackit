import { Minus, Plus, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Card, Icon, Text, colors } from '@/ui';

import { setWeeklyGoal, useWeeklyGoal } from '../queries';

const MIN_GOAL = 1;
const MAX_GOAL = 14;

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

/** Gym preferences slotted into the core Settings screen. */
export function GymSettingsPanel() {
  const goal = useWeeklyGoal();

  return (
    <Card className="flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text variant="body">Weekly workout goal</Text>
        <Text variant="muted">Target sessions per week</Text>
      </View>
      <View className="flex-row items-center gap-3">
        <StepButton
          icon={Minus}
          onPress={() => setWeeklyGoal(Math.max(MIN_GOAL, goal - 1))}
          disabled={goal <= MIN_GOAL}
        />
        <Text variant="heading" className="w-6 text-center">
          {goal}
        </Text>
        <StepButton
          icon={Plus}
          onPress={() => setWeeklyGoal(Math.min(MAX_GOAL, goal + 1))}
          disabled={goal >= MAX_GOAL}
        />
      </View>
    </Card>
  );
}
