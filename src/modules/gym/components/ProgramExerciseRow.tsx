import { CalendarRange, Trash2 } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { WeightUnit } from '@/core/settings/schema';
import { fromDisplayWeight, toDisplayWeight } from '@/core/settings/units';
import { Button, Card, Icon, Text, colors, shallowEqual } from '@/ui';

import { formatWeight } from '../format';
import type { ProgramExerciseRow as ProgramExerciseRowData } from '../queries';
import { DragHandle } from './DragHandle';
import { NumberField } from './NumberField';

export interface ProgramExerciseRowProps {
  row: ProgramExerciseRowData;
  unit: WeightUnit;
  /** Commit a new working weight (lp/dp), already converted to canonical kg. */
  onSetWeight: (programExerciseId: number, weightKg: number) => void;
  /** Commit a new training max (percent), already converted to canonical kg. */
  onSetTrainingMax: (programExerciseId: number, weightKg: number) => void;
  /** Commit a new estimated 1RM (rpe), already converted to canonical kg. */
  onSetE1rm: (programExerciseId: number, weightKg: number) => void;
  onRemove: (programExerciseId: number) => void;
  /** Open the periodization (week × set wave) editor for this slot. */
  onEditWave: (programExerciseId: number, name: string) => void;
  /** Render the drag grip (only valid inside a reorderable list item). */
  reorderable?: boolean;
}

/** One-line summary of the progression rule, e.g. "Double · 3 × 8–12 · +2.5 kg". */
function schemeSummary(row: ProgramExerciseRowData, unit: WeightUnit): string {
  const step = `+${formatWeight(row.incrementKg, unit)}`;
  switch (row.schemeType) {
    case 'dp':
      return `Double · ${row.targetSets} × ${row.minReps}–${row.maxReps} · ${step}`;
    case 'lp':
      return `Linear · ${row.targetSets} × ${row.currentReps} · ${step}`;
    case 'percent':
      return `Percentage · ${row.targetSets} sets of training max`;
    case 'rpe':
      return `RPE ${row.targetRpe ?? 8} · autoregulated`;
  }
}

/**
 * Which mutable anchor a scheme exposes for editing: lp/dp edit the working
 * weight; percent edits the training max; rpe edits the estimated 1RM.
 */
function anchorFor(row: ProgramExerciseRowData): {
  label: string;
  valueKg: number;
  commit: 'weight' | 'tm' | 'e1rm';
} {
  if (row.schemeType === 'percent') {
    return {
      label: 'Training max',
      valueKg: row.trainingMaxKg ?? 0,
      commit: 'tm',
    };
  }
  if (row.schemeType === 'rpe') {
    return { label: 'Est. 1RM', valueKg: row.e1rmKg ?? 0, commit: 'e1rm' };
  }
  return {
    label: 'Working weight',
    valueKg: row.currentWeightKg,
    commit: 'weight',
  };
}

/** Editable program-template row: scheme summary, anchor weight, next-up hint. */
function ProgramExerciseRowComponent({
  row,
  unit,
  onSetWeight,
  onSetTrainingMax,
  onSetE1rm,
  onRemove,
  onEditWave,
  reorderable,
}: ProgramExerciseRowProps) {
  const anchor = anchorFor(row);
  // Edits happen in the display unit; the weight is stored canonical kg.
  const [weight, setWeight] = useState(
    String(toDisplayWeight(anchor.valueKg, unit)),
  );
  const invalid =
    weight.trim() !== '' && Number.isNaN(Number.parseFloat(weight));

  function commit() {
    const parsed = Number.parseFloat(weight);
    if (Number.isNaN(parsed)) {
      // Reflect the revert so the field shows the value actually kept.
      setWeight(String(toDisplayWeight(anchor.valueKg, unit)));
      return;
    }
    const kg = fromDisplayWeight(parsed, unit);
    if (anchor.commit === 'tm') onSetTrainingMax(row.id, kg);
    else if (anchor.commit === 'e1rm') onSetE1rm(row.id, kg);
    else onSetWeight(row.id, kg);
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-2">
        {reorderable ? (
          <View className="-ml-1 pt-0.5">
            <DragHandle />
          </View>
        ) : null}
        <View className="flex-1">
          <Text variant="heading">{row.exerciseName}</Text>
          <Text variant="caption" className="mt-1">
            {schemeSummary(row, unit)}
          </Text>
        </View>
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

      <View className="flex-row items-end gap-3">
        <NumberField
          label={`${anchor.label} (${unit})`}
          value={weight}
          onChangeText={setWeight}
          onEndEditing={commit}
          invalid={invalid}
          className="flex-1"
        />
        {row.lastReason ? (
          <View className="flex-1 pb-3">
            <Text variant="caption" className="uppercase tracking-wider">
              Next up
            </Text>
            <Text style={{ color: colors.primaryBright }}>
              {row.lastReason}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Waves render off the e1RM anchor, which only rpe slots carry — gating
          here keeps an lp/dp slot from generating 0-weight prescribed sets. */}
      {row.schemeType === 'rpe' ? (
        <Button
          label="Periodize weeks"
          variant="ghost"
          size="md"
          leftIcon={
            <Icon icon={CalendarRange} size={16} color={colors.primaryBright} />
          }
          onPress={() => onEditWave(row.id, row.exerciseName)}
        />
      ) : null}
    </Card>
  );
}

/** Memoized so editing one slot's weight doesn't re-render its sibling rows;
    relies on the parent passing stable id-based handlers. */
function propsEqual(
  prev: ProgramExerciseRowProps,
  next: ProgramExerciseRowProps,
): boolean {
  return (
    prev.unit === next.unit &&
    prev.reorderable === next.reorderable &&
    prev.onSetWeight === next.onSetWeight &&
    prev.onSetTrainingMax === next.onSetTrainingMax &&
    prev.onSetE1rm === next.onSetE1rm &&
    prev.onRemove === next.onRemove &&
    prev.onEditWave === next.onEditWave &&
    shallowEqual(prev.row, next.row)
  );
}

export const ProgramExerciseRow = memo(ProgramExerciseRowComponent, propsEqual);
