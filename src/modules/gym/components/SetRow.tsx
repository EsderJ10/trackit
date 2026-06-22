import {
  ArrowDown,
  ArrowUp,
  Check,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { WeightUnit } from '@/core/settings/schema';
import { fromDisplayWeight, toDisplayWeight } from '@/core/settings/units';
import { Icon, Text, cn, colors, glow } from '@/ui';

import { formatWeight } from '../format';
import type { SetLogRow, SetPatch, SetType } from '../queries';
import { compareToPrevious } from '../set-comparison';
import { NumberField } from './NumberField';

export interface SetRowProps {
  set: SetLogRow;
  /** 1-based ordinal *among working sets* — shown on the badge for working sets. */
  displayNumber: number;
  unit: WeightUnit;
  /** The matching set from the last session (canonical kg), if any. */
  previous?: { reps: number; weight: number };
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

/** Weight stepper increment in the display unit (loadable-ish defaults). */
const WEIGHT_STEP: Record<WeightUnit, number> = { kg: 2.5, lb: 5 };

/** The set-type cycle order when tapping the badge; working is the default. */
const SET_TYPE_CYCLE: readonly SetType[] = [
  'working',
  'warmup',
  'drop',
  'failure',
];

/** Glanceable badge per set-type: a letter + accent so the type reads at a glance. */
function setTypeBadge(
  setType: SetType,
  workingNumber: number,
): { label: string; color: string } {
  switch (setType) {
    case 'warmup':
      return { label: 'W', color: colors.fgFaint };
    case 'drop':
      return { label: 'D', color: colors.warning };
    case 'failure':
      return { label: 'F', color: colors.danger };
    case 'working':
      return { label: String(workingNumber), color: colors.fgMuted };
  }
}

/**
 * One persistent set inside an active workout: inline-editable fields (branched
 * by the exercise's measurement kind), a tap-cycle set-type badge, a check to
 * toggle complete, tap- and swipe-delete. Local input state is seeded once and
 * commits on blur so live-query re-renders don't clobber mid-edit text.
 */
export function SetRow({
  set,
  displayNumber,
  unit,
  previous,
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
  const [duration, setDuration] = useState(
    set.durationSec != null ? String(set.durationSec) : '',
  );
  const [distance, setDistance] = useState(
    set.distanceM != null ? String(set.distanceM) : '',
  );
  const completed = set.completedAt != null;

  // Compare the *logged* set against last session only once it's checked off —
  // comparing the prefilled value would read "even" on every untouched row.
  const trend =
    previous && completed
      ? compareToPrevious(
          { reps: set.reps, weightKg: set.weight },
          { reps: previous.reps, weightKg: previous.weight },
        )
      : null;

  function commitReps(next: number) {
    const clamped = Math.max(0, next);
    setReps(String(clamped));
    onUpdate(set.id, { reps: clamped });
  }

  function commitWeightDisplay(displayValue: number) {
    const clamped = Math.max(0, displayValue);
    setWeight(String(clamped));
    onUpdate(set.id, { weight: fromDisplayWeight(clamped, unit) });
  }

  function cycleSetType() {
    const i = SET_TYPE_CYCLE.indexOf(set.setType);
    const next = SET_TYPE_CYCLE[(i + 1) % SET_TYPE_CYCLE.length] ?? 'working';
    onUpdate(set.id, { setType: next });
  }

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

  const badge = setTypeBadge(set.setType, displayNumber);
  const kind = set.measurementKind;
  const showRepsWeight = kind === 'weight_reps' || kind === 'bodyweight';

  return (
    <ReanimatedSwipeable
      renderRightActions={renderRightActions}
      rightThreshold={32}
      friction={2}
      overshootRight={false}
    >
      <View
        className={cn(
          'rounded-xl border px-3 py-2',
          completed
            ? 'border-success bg-surface-hi'
            : 'border-transparent bg-surface-alt',
        )}
      >
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={cycleSetType}
            hitSlop={8}
            className="w-7 items-center active:opacity-60"
          >
            <Text style={{ color: badge.color }} className="font-semibold">
              {badge.label}
            </Text>
          </Pressable>

          {showRepsWeight ? (
            <>
              <StepperField
                value={reps}
                onChangeText={setReps}
                onCommit={() => commitReps(toInt(reps, set.reps))}
                onStep={(dir) => commitReps(toInt(reps, set.reps) + dir)}
              />
              <Text variant="muted">{kind === 'bodyweight' ? '＋' : '×'}</Text>
              <StepperField
                value={weight}
                onChangeText={setWeight}
                onCommit={() =>
                  commitWeightDisplay(
                    toFloat(weight, toDisplayWeight(set.weight, unit)),
                  )
                }
                onStep={(dir) =>
                  commitWeightDisplay(
                    toFloat(weight, toDisplayWeight(set.weight, unit)) +
                      dir * WEIGHT_STEP[unit],
                  )
                }
              />
              <Text variant="caption" className="w-6">
                {unit}
              </Text>
            </>
          ) : kind === 'duration' ? (
            <NumberField
              value={duration}
              placeholder="sec"
              onChangeText={setDuration}
              onEndEditing={() =>
                onUpdate(set.id, { durationSec: toInt(duration, 0) })
              }
              className="flex-1"
            />
          ) : (
            <>
              <NumberField
                value={distance}
                placeholder="m"
                onChangeText={setDistance}
                onEndEditing={() =>
                  onUpdate(set.id, { distanceM: toFloat(distance, 0) })
                }
                className="flex-1"
              />
              <NumberField
                value={duration}
                placeholder="sec"
                onChangeText={setDuration}
                onEndEditing={() =>
                  onUpdate(set.id, { durationSec: toInt(duration, 0) })
                }
                className="flex-1"
              />
            </>
          )}

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
        </View>

        {previous && showRepsWeight ? (
          <View className="mt-1 flex-row items-center gap-1 pl-9">
            <Text variant="caption">
              prev {previous.reps} × {formatWeight(previous.weight, unit)}
            </Text>
            {trend === 'up' ? (
              <Icon icon={ArrowUp} size={13} color={colors.success} />
            ) : trend === 'down' ? (
              <Icon icon={ArrowDown} size={13} color={colors.fgFaint} />
            ) : null}
          </View>
        ) : null}
      </View>
    </ReanimatedSwipeable>
  );
}

/** A numeric field flanked by −/＋ steppers for keyboard-free entry. */
function StepperField({
  value,
  onChangeText,
  onCommit,
  onStep,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onCommit: () => void;
  onStep: (direction: 1 | -1) => void;
}) {
  return (
    <View className="flex-1 flex-row items-center gap-1">
      <Pressable
        onPress={() => onStep(-1)}
        hitSlop={6}
        className="h-9 w-7 items-center justify-center rounded-lg bg-surface-hi active:opacity-60"
      >
        <Icon icon={Minus} size={15} color={colors.fgMuted} />
      </Pressable>
      <NumberField
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onCommit}
        className="flex-1"
      />
      <Pressable
        onPress={() => onStep(1)}
        hitSlop={6}
        className="h-9 w-7 items-center justify-center rounded-lg bg-surface-hi active:opacity-60"
      >
        <Icon icon={Plus} size={15} color={colors.fgMuted} />
      </Pressable>
    </View>
  );
}
