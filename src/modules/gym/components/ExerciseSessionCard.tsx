import { Plus, Trash2 } from 'lucide-react-native';
import { Alert, Pressable, View } from 'react-native';

import type { WeightUnit } from '@/core/settings/schema';
import { Button, Card, Icon, Text, colors } from '@/ui';

import { formatWeight } from '../format';
import type { SetLogRow } from '../queries';
import { SetRow } from './SetRow';

export interface ExerciseTarget {
  sets: number;
  reps: number;
  weight: number | null;
}

export interface ExerciseSessionCardProps {
  name: string;
  target?: ExerciseTarget;
  sets: SetLogRow[];
  unit: WeightUnit;
  onAddSet: () => void;
  onUpdateSet: (id: number, patch: { reps?: number; weight?: number }) => void;
  onToggleSet: (id: number, completed: boolean) => void;
  onDeleteSet: (id: number) => void;
  onRemove: () => void;
}

/** One exercise inside an active workout: target, editable set rows, controls. */
export function ExerciseSessionCard({
  name,
  target,
  sets,
  unit,
  onAddSet,
  onUpdateSet,
  onToggleSet,
  onDeleteSet,
  onRemove,
}: ExerciseSessionCardProps) {
  function confirmRemove() {
    Alert.alert('Remove exercise', `Remove ${name} from this workout?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemove },
    ]);
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text variant="heading">{name}</Text>
          {target ? (
            <Text variant="muted" className="mt-1">
              Target: {target.sets} × {target.reps}
              {target.weight != null
                ? ` @ ${formatWeight(target.weight, unit)}`
                : ''}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={confirmRemove}
          hitSlop={8}
          className="active:opacity-60"
        >
          <Icon icon={Trash2} size={18} color={colors.fgFaint} />
        </Pressable>
      </View>

      {sets.length > 0 ? (
        <View className="gap-1">
          {sets.map((set, index) => (
            <SetRow
              key={set.id}
              set={set}
              index={index}
              unit={unit}
              onUpdate={onUpdateSet}
              onToggle={onToggleSet}
              onDelete={onDeleteSet}
            />
          ))}
        </View>
      ) : null}

      <Button
        label="Add set"
        variant="secondary"
        size="md"
        leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
        onPress={onAddSet}
      />
    </Card>
  );
}
