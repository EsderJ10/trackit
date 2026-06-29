import { Link, Link2Off, Trash2 } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { WeightUnit } from '@/core/settings/schema';
import { fromDisplayWeight, toDisplayWeight } from '@/core/settings/units';
import { Card, Icon, Text, colors, shallowEqual, tint } from '@/ui';

import type { RoutineExerciseRow as RoutineExerciseRowData } from '../queries';
import type { SupersetBadge } from '../supersets';
import { NumberField } from './NumberField';

export interface RoutineExerciseRowProps {
  row: RoutineExerciseRowData;
  unit: WeightUnit;
  /** Superset badge when this row is part of a multi-exercise group. */
  supersetBadge?: SupersetBadge;
  /** Whether this row can be linked into a superset with the one above it. */
  canLink: boolean;
  onUpdate: (
    id: number,
    patch: {
      targetSets?: number;
      targetReps?: number;
      targetWeight?: number | null;
    },
  ) => void;
  onRemove: (id: number) => void;
  /** Link this row into a superset with the previous exercise. */
  onLink: (id: number) => void;
  /** Remove this row from its superset. */
  onUnlink: (id: number) => void;
}

function toInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function RoutineExerciseRowComponent({
  row,
  unit,
  supersetBadge,
  canLink,
  onUpdate,
  onRemove,
  onLink,
  onUnlink,
}: RoutineExerciseRowProps) {
  const [sets, setSets] = useState(String(row.targetSets));
  const [reps, setReps] = useState(String(row.targetReps));
  // Edits in the display unit; targetWeight is stored canonical kg.
  const [weight, setWeight] = useState(
    row.targetWeight != null
      ? String(toDisplayWeight(row.targetWeight, unit))
      : '',
  );
  const weightInvalid =
    weight.trim() !== '' && Number.isNaN(Number.parseFloat(weight));

  function commitSets() {
    const value = toInt(sets, row.targetSets);
    setSets(String(value));
    onUpdate(row.id, { targetSets: value });
  }

  function commitReps() {
    const value = toInt(reps, row.targetReps);
    setReps(String(value));
    onUpdate(row.id, { targetReps: value });
  }

  function commitWeight() {
    const parsed = Number.parseFloat(weight);
    if (Number.isNaN(parsed)) {
      // An empty/invalid field means "no target weight"; reflect that.
      setWeight('');
      onUpdate(row.id, { targetWeight: null });
      return;
    }
    onUpdate(row.id, { targetWeight: fromDisplayWeight(parsed, unit) });
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            {supersetBadge ? (
              <View
                className="rounded-md px-1.5 py-0.5"
                style={{ backgroundColor: tint(colors.gym, 0.18) }}
              >
                <Text
                  variant="caption"
                  style={{ color: colors.gym, fontWeight: '700' }}
                >
                  {supersetBadge.letter}
                  {supersetBadge.ordinal}
                </Text>
              </View>
            ) : null}
            <Text variant="heading">{row.exerciseName}</Text>
          </View>
          <Text variant="caption" className="mt-1 uppercase tracking-wider">
            {row.muscleGroup}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          {supersetBadge ? (
            <Pressable
              onPress={() => onUnlink(row.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${row.exerciseName} from its superset`}
              className="active:opacity-60"
            >
              <Icon icon={Link2Off} size={18} color={colors.gym} />
            </Pressable>
          ) : canLink ? (
            <Pressable
              onPress={() => onLink(row.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Superset ${row.exerciseName} with the exercise above`}
              className="active:opacity-60"
            >
              <Icon icon={Link} size={18} color={colors.fgFaint} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onRemove(row.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${row.exerciseName}`}
            className="active:opacity-60"
          >
            <Icon icon={Trash2} size={18} color={colors.fgFaint} />
          </Pressable>
        </View>
      </View>

      <View className="flex-row gap-2">
        <NumberField
          label="Sets"
          value={sets}
          onChangeText={setSets}
          onEndEditing={commitSets}
          accessibilityLabel={`Sets for ${row.exerciseName}`}
          className="flex-1"
        />
        <NumberField
          label="Reps"
          value={reps}
          onChangeText={setReps}
          onEndEditing={commitReps}
          accessibilityLabel={`Reps for ${row.exerciseName}`}
          className="flex-1"
        />
        <NumberField
          label={`Wt (${unit})`}
          value={weight}
          onChangeText={setWeight}
          onEndEditing={commitWeight}
          invalid={weightInvalid}
          accessibilityLabel={`Target weight for ${row.exerciseName}`}
          className="flex-1"
        />
      </View>
    </Card>
  );
}

/** Memoized so editing one routine row leaves its siblings untouched; relies on
    the parent passing stable id-based handlers. */
function propsEqual(
  prev: RoutineExerciseRowProps,
  next: RoutineExerciseRowProps,
): boolean {
  const a = prev.supersetBadge;
  const b = next.supersetBadge;
  const badgeEqual =
    a?.letter === b?.letter && a?.ordinal === b?.ordinal && a?.size === b?.size;
  return (
    prev.unit === next.unit &&
    prev.canLink === next.canLink &&
    prev.onUpdate === next.onUpdate &&
    prev.onRemove === next.onRemove &&
    prev.onLink === next.onLink &&
    prev.onUnlink === next.onUnlink &&
    badgeEqual &&
    shallowEqual(prev.row, next.row)
  );
}

export const RoutineExerciseRow = memo(RoutineExerciseRowComponent, propsEqual);
