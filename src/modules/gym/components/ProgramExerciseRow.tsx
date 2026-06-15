import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { WeightUnit } from '@/core/settings/schema';
import { fromDisplayWeight, toDisplayWeight } from '@/core/settings/units';
import { Card, Icon, Text, colors } from '@/ui';

import { formatWeight } from '../format';
import type { ProgramExerciseRow as ProgramExerciseRowData } from '../queries';
import { NumberField } from './NumberField';

export interface ProgramExerciseRowProps {
  row: ProgramExerciseRowData;
  unit: WeightUnit;
  /** Commit a new working weight (lp/dp), already converted to canonical kg. */
  onSetWeight: (weightKg: number) => void;
  /** Commit a new training max (percent), already converted to canonical kg. */
  onSetTrainingMax: (weightKg: number) => void;
  /** Commit a new estimated 1RM (rpe), already converted to canonical kg. */
  onSetE1rm: (weightKg: number) => void;
  onRemove: () => void;
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
function anchorFor(
  row: ProgramExerciseRowData,
): { label: string; valueKg: number; commit: 'weight' | 'tm' | 'e1rm' } {
  if (row.schemeType === 'percent') {
    return { label: 'Training max', valueKg: row.trainingMaxKg ?? 0, commit: 'tm' };
  }
  if (row.schemeType === 'rpe') {
    return { label: 'Est. 1RM', valueKg: row.e1rmKg ?? 0, commit: 'e1rm' };
  }
  return { label: 'Working weight', valueKg: row.currentWeightKg, commit: 'weight' };
}

/** Editable program-template row: scheme summary, anchor weight, next-up hint. */
export function ProgramExerciseRow({
  row,
  unit,
  onSetWeight,
  onSetTrainingMax,
  onSetE1rm,
  onRemove,
}: ProgramExerciseRowProps) {
  const anchor = anchorFor(row);
  // Edits happen in the display unit; the weight is stored canonical kg.
  const [weight, setWeight] = useState(
    String(toDisplayWeight(anchor.valueKg, unit)),
  );

  function commit() {
    const parsed = Number.parseFloat(weight);
    if (Number.isNaN(parsed)) {
      setWeight(String(toDisplayWeight(anchor.valueKg, unit)));
      return;
    }
    const kg = fromDisplayWeight(parsed, unit);
    if (anchor.commit === 'tm') onSetTrainingMax(kg);
    else if (anchor.commit === 'e1rm') onSetE1rm(kg);
    else onSetWeight(kg);
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text variant="heading">{row.exerciseName}</Text>
          <Text variant="caption" className="mt-1">
            {schemeSummary(row, unit)}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8} className="active:opacity-60">
          <Icon icon={Trash2} size={18} color={colors.fgFaint} />
        </Pressable>
      </View>

      <View className="flex-row items-end gap-3">
        <NumberField
          label={`${anchor.label} (${unit})`}
          value={weight}
          onChangeText={setWeight}
          onEndEditing={commit}
          className="flex-1"
        />
        {row.lastReason ? (
          <View className="flex-1 pb-3">
            <Text variant="caption" className="uppercase tracking-wider">
              Next up
            </Text>
            <Text style={{ color: colors.primaryBright }}>{row.lastReason}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
