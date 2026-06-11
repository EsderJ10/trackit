import { X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { WeightUnit } from '@/core/settings/schema';
import { Card, Icon, Text, colors } from '@/ui';

import { formatWeight } from '../format';
import type { SetLogRow } from '../queries';
import { SetLogger } from './SetLogger';

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
  onLog: (reps: number, weight: number) => void;
  onDeleteSet: (id: number) => void;
}

/** One exercise inside an active workout: target, logged sets, and a logger. */
export function ExerciseSessionCard({
  name,
  target,
  sets,
  unit,
  onLog,
  onDeleteSet,
}: ExerciseSessionCardProps) {
  const lastWeight = sets.at(-1)?.weight ?? target?.weight ?? null;

  return (
    <Card className="gap-3">
      <View>
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

      {sets.length > 0 ? (
        <View className="gap-1">
          {sets.map((set, index) => (
            <View
              key={set.id}
              className="flex-row items-center justify-between rounded-xl bg-surface-alt px-3 py-2"
            >
              <Text variant="muted">Set {index + 1}</Text>
              <Text variant="label">
                {set.reps} × {formatWeight(set.weight, unit)}
              </Text>
              <Pressable
                onPress={() => onDeleteSet(set.id)}
                hitSlop={8}
                className="active:opacity-60"
              >
                <Icon icon={X} size={16} color={colors.fgFaint} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <SetLogger unit={unit} defaultWeight={lastWeight} onLog={onLog} />
    </Card>
  );
}
