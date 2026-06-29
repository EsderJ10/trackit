import { CalendarRange, Link, Link2Off, Trash2 } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { WeightUnit } from '@/core/settings/schema';
import { fromDisplayWeight, toDisplayWeight } from '@/core/settings/units';
import { Button, Card, Icon, Text, colors, shallowEqual, tint } from '@/ui';

import { formatWeight } from '../format';
import { SCHEME_PRESETS } from '../program-schemes';
import type {
  ProgramExerciseRow as ProgramExerciseRowData,
  ProgramSchemeChoice,
} from '../queries';
import type { SupersetBadge } from '../supersets';
import { DragHandle } from './DragHandle';
import { NumberField } from './NumberField';

export interface ProgramExerciseRowProps {
  row: ProgramExerciseRowData;
  unit: WeightUnit;
  /** Superset badge when this row is part of a multi-exercise group. */
  supersetBadge?: SupersetBadge;
  /** Whether this row can be linked into a superset with the one above it. */
  canLink: boolean;
  /** Commit a new working weight (lp/dp), already converted to canonical kg. */
  onSetWeight: (programExerciseId: number, weightKg: number) => void;
  /** Commit a new training max (percent), already converted to canonical kg. */
  onSetTrainingMax: (programExerciseId: number, weightKg: number) => void;
  /** Commit a new estimated 1RM (rpe), already converted to canonical kg. */
  onSetE1rm: (programExerciseId: number, weightKg: number) => void;
  onRemove: (programExerciseId: number) => void;
  /** Open the periodization (week × set wave) editor for this slot. */
  onEditWave: (programExerciseId: number, name: string) => void;
  /** Switch this slot's progression scheme. */
  onChangeScheme: (programExerciseId: number, scheme: ProgramSchemeChoice) => void;
  /** Link this row into a superset with the previous exercise in the day. */
  onLink: (programExerciseId: number) => void;
  /** Remove this row from its superset. */
  onUnlink: (programExerciseId: number) => void;
  /** Render the drag grip (only valid inside a reorderable list item). */
  reorderable?: boolean;
}

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

function ProgramExerciseRowComponent({
  row,
  unit,
  supersetBadge,
  canLink,
  onSetWeight,
  onSetTrainingMax,
  onSetE1rm,
  onRemove,
  onEditWave,
  onChangeScheme,
  onLink,
  onUnlink,
  reorderable,
}: ProgramExerciseRowProps) {
  const [editingScheme, setEditingScheme] = useState(false);
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
          <Pressable
            onPress={() => setEditingScheme((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={`Change progression for ${row.exerciseName}`}
            hitSlop={6}
            className="active:opacity-70"
          >
            <Text
              variant="caption"
              className="mt-1"
              style={{ color: editingScheme ? colors.primaryBright : undefined }}
            >
              {schemeSummary(row, unit)}
            </Text>
          </Pressable>
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

      {editingScheme ? (
        <View className="gap-2 rounded-xl border border-border-soft bg-surface-alt/40 p-2">
          <Text variant="caption" className="uppercase tracking-wider">
            Progression
          </Text>
          {SCHEME_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              label={preset.label}
              variant="secondary"
              size="md"
              onPress={() => {
                onChangeScheme(row.id, preset.scheme);
                setEditingScheme(false);
              }}
            />
          ))}
          <Button
            label="Cancel"
            variant="ghost"
            size="md"
            onPress={() => setEditingScheme(false)}
          />
        </View>
      ) : null}

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
  const a = prev.supersetBadge;
  const b = next.supersetBadge;
  const badgeEqual =
    a?.letter === b?.letter && a?.ordinal === b?.ordinal && a?.size === b?.size;
  return (
    prev.unit === next.unit &&
    prev.reorderable === next.reorderable &&
    prev.canLink === next.canLink &&
    prev.onSetWeight === next.onSetWeight &&
    prev.onSetTrainingMax === next.onSetTrainingMax &&
    prev.onSetE1rm === next.onSetE1rm &&
    prev.onRemove === next.onRemove &&
    prev.onEditWave === next.onEditWave &&
    prev.onChangeScheme === next.onChangeScheme &&
    prev.onLink === next.onLink &&
    prev.onUnlink === next.onUnlink &&
    badgeEqual &&
    shallowEqual(prev.row, next.row)
  );
}

export const ProgramExerciseRow = memo(ProgramExerciseRowComponent, propsEqual);
