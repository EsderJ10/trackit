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
  /** Commit a new working weight (already converted to canonical kg). */
  onSetWeight: (weightKg: number) => void;
  onRemove: () => void;
}

/** One-line summary of the progression rule, e.g. "Double · 3 × 8–12 · +2.5 kg". */
function schemeSummary(row: ProgramExerciseRowData, unit: WeightUnit): string {
  const step = `+${formatWeight(row.incrementKg, unit)}`;
  if (row.schemeType === 'dp') {
    return `Double · ${row.targetSets} × ${row.minReps}–${row.maxReps} · ${step}`;
  }
  if (row.schemeType === 'lp') {
    return `Linear · ${row.targetSets} × ${row.currentReps} · ${step}`;
  }
  return row.schemeType.toUpperCase();
}

/** Editable program-template row: scheme summary, starting weight, next-up hint. */
export function ProgramExerciseRow({
  row,
  unit,
  onSetWeight,
  onRemove,
}: ProgramExerciseRowProps) {
  // Edits happen in the display unit; the weight is stored canonical kg.
  const [weight, setWeight] = useState(
    String(toDisplayWeight(row.currentWeightKg, unit)),
  );

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
          label={`Working weight (${unit})`}
          value={weight}
          onChangeText={setWeight}
          onEndEditing={() => {
            const parsed = Number.parseFloat(weight);
            if (Number.isNaN(parsed)) {
              setWeight(String(toDisplayWeight(row.currentWeightKg, unit)));
              return;
            }
            onSetWeight(fromDisplayWeight(parsed, unit));
          }}
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
    </Card>
  );
}
