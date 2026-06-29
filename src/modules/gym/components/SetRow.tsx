import { ArrowDown, ArrowUp, Check, Trash2 } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { WeightUnit } from '@/core/settings/schema';
import { fromDisplayWeight, toDisplayWeight } from '@/core/settings/units';
import { Icon, Text, cn, colors, glow } from '@/ui';

import {
  type EffortScale,
  effortBounds,
  effortInputValue,
  effortLabel,
  parseEffortInput,
} from '../effort';
import { formatWeight } from '../format';
import type { SetLogRow, SetPatch, SetType } from '../queries';
import { compareToPrevious } from '../set-comparison';
import { NumberField } from './NumberField';

export interface SetRowProps {
  set: SetLogRow;
  /** 1-based ordinal *among working sets* — shown on the badge for working sets. */
  displayNumber: number;
  unit: WeightUnit;
  /** Which effort scale (RPE/RIR) the effort field reads and writes. */
  effortScale: EffortScale;
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
function SetRowComponent({
  set,
  displayNumber,
  unit,
  effortScale,
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
  // The field edits in the chosen effort scale; storage stays canonical RPE.
  const [rpe, setRpe] = useState(effortInputValue(set.rpe, effortScale));
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

  function confirmDelete() {
    Alert.alert('Delete set', 'Delete this set?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(set.id) },
    ]);
  }

  function renderRightActions() {
    return (
      <Pressable
        onPress={confirmDelete}
        accessibilityRole="button"
        accessibilityLabel="Delete set"
        className="my-0.5 ml-2 items-center justify-center rounded-xl bg-danger px-5 active:opacity-80"
      >
        <Icon icon={Trash2} size={18} color={colors.bg} />
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
            accessibilityRole="button"
            accessibilityLabel={`Set type: ${set.setType}. Tap to change.`}
            hitSlop={8}
            className="w-7 items-center active:opacity-60"
          >
            <Text style={{ color: badge.color, fontWeight: '600' }}>
              {badge.label}
            </Text>
          </Pressable>

          {showRepsWeight ? (
            <>
              <NumberField
                value={reps}
                onChangeText={setReps}
                onEndEditing={() => commitReps(toInt(reps, set.reps))}
                accessibilityLabel="Reps"
                className="flex-1"
              />
              <Text variant="muted">{kind === 'bodyweight' ? '＋' : '×'}</Text>
              <NumberField
                value={weight}
                onChangeText={setWeight}
                onEndEditing={() =>
                  commitWeightDisplay(
                    toFloat(weight, toDisplayWeight(set.weight, unit)),
                  )
                }
                accessibilityLabel={`Weight in ${unit}`}
                className="flex-1"
              />
              <Text variant="caption" className="w-6">
                {unit}
              </Text>
              <RpeField
                rpe={rpe}
                setRpe={setRpe}
                scale={effortScale}
                onUpdate={onUpdate}
                setId={set.id}
              />
            </>
          ) : kind === 'duration' ? (
            <>
              <NumberField
                value={duration}
                placeholder="sec"
                onChangeText={setDuration}
                onEndEditing={() =>
                  onUpdate(set.id, { durationSec: toInt(duration, 0) })
                }
                accessibilityLabel="Duration in seconds"
                className="flex-1"
              />
              <RpeField
                rpe={rpe}
                setRpe={setRpe}
                scale={effortScale}
                onUpdate={onUpdate}
                setId={set.id}
              />
            </>
          ) : (
            <>
              <NumberField
                value={distance}
                placeholder="m"
                onChangeText={setDistance}
                onEndEditing={() =>
                  onUpdate(set.id, { distanceM: toFloat(distance, 0) })
                }
                accessibilityLabel="Distance in meters"
                className="flex-1"
              />
              <NumberField
                value={duration}
                placeholder="sec"
                onChangeText={setDuration}
                onEndEditing={() =>
                  onUpdate(set.id, { durationSec: toInt(duration, 0) })
                }
                accessibilityLabel="Duration in seconds"
                className="flex-1"
              />
              <RpeField
                rpe={rpe}
                setRpe={setRpe}
                scale={effortScale}
                onUpdate={onUpdate}
                setId={set.id}
              />
            </>
          )}

          <Pressable
            onPress={() => onToggle(set.id, !completed)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: completed }}
            accessibilityLabel={
              completed ? 'Mark set incomplete' : 'Complete set'
            }
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

        {/* Previous-set cue tucks under the number row as a quiet reference; it
            only appears when there's a prior session to compare against. */}
        {showRepsWeight && previous ? (
          <View className="mt-1.5 flex-row items-center gap-1 pl-9">
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

/**
 * The live query hands a fresh `set` object to every row on each set commit, so
 * a plain `React.memo` would never skip. Compare the scalar fields that drive
 * this row's render instead, so only the row whose set actually changed
 * re-renders — the rest stay put mid-workout. Relies on the handlers being
 * referentially stable (see `ActiveWorkout`).
 */
function setRowPropsEqual(prev: SetRowProps, next: SetRowProps): boolean {
  if (
    prev.displayNumber !== next.displayNumber ||
    prev.unit !== next.unit ||
    prev.effortScale !== next.effortScale ||
    prev.onUpdate !== next.onUpdate ||
    prev.onToggle !== next.onToggle ||
    prev.onDelete !== next.onDelete ||
    prev.previous?.reps !== next.previous?.reps ||
    prev.previous?.weight !== next.previous?.weight
  ) {
    return false;
  }
  const a = prev.set;
  const b = next.set;
  return (
    a.id === b.id &&
    a.reps === b.reps &&
    a.weight === b.weight &&
    a.rpe === b.rpe &&
    a.durationSec === b.durationSec &&
    a.distanceM === b.distanceM &&
    a.setType === b.setType &&
    a.measurementKind === b.measurementKind &&
    a.completedAt === b.completedAt
  );
}

/** Memoized so a commit re-renders only the changed row (see comparator). */
export const SetRow = memo(SetRowComponent, setRowPropsEqual);

/** The optional effort field (RPE or RIR); sits inline on the number row, kept
    narrow since the scale is single-digit so reps/weight keep the width. The
    field edits in the chosen scale; `onUpdate` always receives canonical RPE. */
function RpeField({
  rpe,
  setRpe,
  scale,
  onUpdate,
  setId,
}: {
  rpe: string;
  setRpe: (text: string) => void;
  scale: EffortScale;
  onUpdate: (id: number, patch: SetPatch) => void;
  setId: number;
}) {
  const parsed = Number.parseFloat(rpe);
  // Flag anything outside the scale's range so the user sees it before it's
  // silently clamped on blur (RPE 1–10, RIR 0–9).
  const { min, max } = effortBounds(scale);
  const invalid =
    rpe.trim() !== '' && (Number.isNaN(parsed) || parsed < min || parsed > max);

  function commit() {
    const value = parseEffortInput(rpe, scale);
    // Reflect the clamped value (e.g. RPE 15 → 10) so the field shows what was
    // kept, converted back into the display scale.
    setRpe(effortInputValue(value, scale));
    onUpdate(setId, { rpe: value });
  }

  return (
    <NumberField
      value={rpe}
      placeholder={effortLabel(scale)}
      onChangeText={setRpe}
      onEndEditing={commit}
      invalid={invalid}
      accessibilityLabel={
        scale === 'rir'
          ? 'RIR, reps in reserve'
          : 'RPE, rate of perceived exertion'
      }
      className="w-14"
    />
  );
}
