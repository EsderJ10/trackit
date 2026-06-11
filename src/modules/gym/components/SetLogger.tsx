import { useState } from 'react';
import { View } from 'react-native';

import type { WeightUnit } from '@/core/settings/schema';
import { Button } from '@/ui';

import { NumberField } from './NumberField';

export interface SetLoggerProps {
  unit: WeightUnit;
  defaultWeight?: number | null;
  onLog: (reps: number, weight: number) => void;
}

/** Reps + weight inputs with a Log button to record one set. */
export function SetLogger({ unit, defaultWeight, onLog }: SetLoggerProps) {
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState(
    defaultWeight != null ? String(defaultWeight) : '',
  );

  function submit() {
    const parsedReps = Number.parseInt(reps, 10);
    if (Number.isNaN(parsedReps) || parsedReps <= 0) return;
    const parsedWeight = Number.parseFloat(weight);
    onLog(parsedReps, Number.isNaN(parsedWeight) ? 0 : parsedWeight);
    setReps('');
  }

  return (
    <View className="flex-row items-end gap-2">
      <NumberField
        label="Reps"
        value={reps}
        onChangeText={setReps}
        className="flex-1"
      />
      <NumberField
        label={`Weight (${unit})`}
        value={weight}
        onChangeText={setWeight}
        className="flex-1"
      />
      <Button
        label="Log"
        size="md"
        onPress={submit}
        disabled={reps.trim() === ''}
      />
    </View>
  );
}
