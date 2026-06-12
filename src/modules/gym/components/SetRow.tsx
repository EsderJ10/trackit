import { Check, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { WeightUnit } from '@/core/settings/schema';
import { fromDisplayWeight, toDisplayWeight } from '@/core/settings/units';
import { Icon, Text, cn, colors, glow } from '@/ui';

import type { SetLogRow, SetPatch } from '../queries';
import { NumberField } from './NumberField';

export interface SetRowProps {
  set: SetLogRow;
  index: number;
  unit: WeightUnit;
  onUpdate: (id: number, patch: SetPatch) => void;
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
}

function toInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toFloat(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** Empty input clears RPE; otherwise parse and clamp to the 1–10 scale. */
function toRpe(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  return Math.min(10, Math.max(1, parsed));
}

/**
 * One persistent set inside an active workout: inline-editable reps/weight, a
 * check to toggle complete, a tap-delete, and swipe-left to delete. Local input
 * state is seeded once and commits on blur so live-query re-renders don't clobber
 * mid-edit text.
 */
export function SetRow({
  set,
  index,
  unit,
  onUpdate,
  onToggle,
  onDelete,
}: SetRowProps) {
  const [reps, setReps] = useState(String(set.reps));
  // The field edits in the display unit; storage stays canonical kg.
  const [weight, setWeight] = useState(
    String(toDisplayWeight(set.weight, unit)),
  );
  const [rpe, setRpe] = useState(set.rpe != null ? String(set.rpe) : '');
  const completed = set.completedAt != null;

  function renderRightActions() {
    return (
      <Pressable
        onPress={() => onDelete(set.id)}
        className="my-0.5 ml-2 items-center justify-center rounded-xl bg-danger px-5 active:opacity-80"
      >
        <Icon icon={Trash2} size={18} color={colors.fg} />
      </Pressable>
    );
  }

  return (
    <ReanimatedSwipeable
      renderRightActions={renderRightActions}
      rightThreshold={32}
      friction={2}
      overshootRight={false}
    >
      <View
        className={cn(
          'flex-row items-center gap-2 rounded-xl border px-3 py-2',
          completed
            ? 'border-success bg-surface-hi'
            : 'border-transparent bg-surface-alt',
        )}
      >
        <Text variant="muted" className="w-7">
          {index + 1}
        </Text>

        <NumberField
          value={reps}
          onChangeText={setReps}
          onEndEditing={() => onUpdate(set.id, { reps: toInt(reps, set.reps) })}
          className="flex-1"
        />
        <Text variant="muted">×</Text>
        <NumberField
          value={weight}
          onChangeText={setWeight}
          onEndEditing={() =>
            onUpdate(set.id, {
              weight: fromDisplayWeight(
                toFloat(weight, toDisplayWeight(set.weight, unit)),
                unit,
              ),
            })
          }
          className="flex-1"
        />
        <Text variant="caption" className="w-6">
          {unit}
        </Text>

        <NumberField
          value={rpe}
          placeholder="RPE"
          onChangeText={setRpe}
          onEndEditing={() => onUpdate(set.id, { rpe: toRpe(rpe) })}
          className="w-14"
        />

        <Pressable
          onPress={() => onToggle(set.id, !completed)}
          hitSlop={8}
          className="active:opacity-70"
          style={completed ? glow(colors.success, 0.5) : undefined}
        >
          <View
            className={cn(
              'h-9 w-9 items-center justify-center rounded-full border-2',
              completed ? 'border-success bg-success' : 'border-border',
            )}
          >
            <Icon
              icon={Check}
              size={18}
              color={completed ? colors.bg : colors.fgFaint}
            />
          </View>
        </Pressable>

        <Pressable
          onPress={() => onDelete(set.id)}
          hitSlop={8}
          className="active:opacity-60"
        >
          <Icon icon={X} size={16} color={colors.fgFaint} />
        </Pressable>
      </View>
    </ReanimatedSwipeable>
  );
}
