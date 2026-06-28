import { Sparkles, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Icon, Text, colors } from '@/ui';

import type { WaveRules } from '../progression-engine';
import {
  generateProgramWave,
  removeProgramSet,
  useProgramSets,
  type ProgramSetRow,
} from '../queries';

export interface ProgramWaveEditorProps {
  visible: boolean;
  onClose: () => void;
  programExerciseId: number | null;
  exerciseName: string;
}

type FormKey =
  | 'weekCount'
  | 'setsStart'
  | 'setsEnd'
  | 'reps'
  | 'rirStart'
  | 'rirEnd';

/** Default mesocycle: 4 hard weeks MEV→MRV, RIR 3→1, + a light deload. */
const DEFAULT_FORM: Record<FormKey, string> = {
  weekCount: '4',
  setsStart: '3',
  setsEnd: '5',
  reps: '8',
  rirStart: '3',
  rirEnd: '1',
};

const FIELDS: { key: FormKey; label: string }[] = [
  { key: 'weekCount', label: 'Weeks' },
  { key: 'reps', label: 'Reps' },
  { key: 'setsStart', label: 'Sets · wk1 (MEV)' },
  { key: 'setsEnd', label: 'Sets · last (MRV)' },
  { key: 'rirStart', label: 'RIR · wk1' },
  { key: 'rirEnd', label: 'RIR · last' },
];

/** Describe one prescription cell, e.g. "8 × RPE 8" or "5 × 80% · 1+". */
function cellLabel(set: ProgramSetRow): string {
  const intensity =
    set.intensityKind === 'rpe'
      ? `RPE ${set.intensityValue}`
      : set.intensityKind === 'pct'
        ? `${Math.round(set.intensityValue * 100)}%`
        : `${set.intensityValue} kg`;
  return `${set.reps} × ${intensity}${set.amrap ? ' · 1+' : ''}`;
}

/**
 * Author a periodized week × set wave for one program slot. The "Generate wave"
 * form fills every cell from descending-RIR + MEV→MRV set-ramp rules; the grid
 * below shows the result and lets you drop individual sets (manual escape hatch).
 */
export function ProgramWaveEditor({
  visible,
  onClose,
  programExerciseId,
  exerciseName,
}: ProgramWaveEditorProps) {
  const { data: sets } = useProgramSets(programExerciseId ?? -1);
  const [form, setForm] = useState<Record<FormKey, string>>(DEFAULT_FORM);
  const [amrap, setAmrap] = useState(false);
  const [deload, setDeload] = useState(true);

  const byWeek = useMemo(() => {
    const map = new Map<number, ProgramSetRow[]>();
    for (const set of sets) {
      const list = map.get(set.weekIndex) ?? [];
      list.push(set);
      map.set(set.weekIndex, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [sets]);

  function num(key: FormKey, fallback: number): number {
    const parsed = Number.parseInt(form[key], 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  function generate() {
    if (programExerciseId == null) return;
    const reps = num('reps', 8);
    const rules: WaveRules = {
      weekCount: Math.max(1, num('weekCount', 4)),
      setsStart: Math.max(1, num('setsStart', 3)),
      setsEnd: Math.max(1, num('setsEnd', 5)),
      reps: Math.max(1, reps),
      rirStart: Math.max(0, num('rirStart', 3)),
      rirEnd: Math.max(0, num('rirEnd', 1)),
      amrapLastSet: amrap,
      deload: deload ? { sets: 2, reps, rir: 4 } : undefined,
    };
    generateProgramWave(programExerciseId, rules);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <SafeAreaView
          edges={['bottom']}
          style={{ backgroundColor: colors.surface, maxHeight: '90%' }}
        >
          <View className="flex-row items-center justify-between border-b border-border-soft p-4">
            <View className="flex-1">
              <Text variant="heading">Periodize</Text>
              <Text variant="caption" className="mt-0.5">
                {exerciseName}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="active:opacity-60"
            >
              <Icon icon={X} size={22} color={colors.fgMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="p-4 gap-4">
            <Card className="gap-3">
              <Text variant="label">Generate wave</Text>
              <Text variant="caption">
                Sets ramp MEV→MRV and RIR descends across the weeks; intensity is
                stored as a target RPE per set.
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {FIELDS.map((field) => (
                  <View key={field.key} className="min-w-[28%] flex-1 gap-1">
                    <Text variant="caption" className="uppercase tracking-wider">
                      {field.label}
                    </Text>
                    <TextInput
                      value={form[field.key]}
                      onChangeText={(text) =>
                        setForm((prev) => ({ ...prev, [field.key]: text }))
                      }
                      keyboardType="numeric"
                      selectTextOnFocus
                      className="rounded-xl border border-border bg-surface-hi px-3 py-2.5 text-center text-base text-fg"
                    />
                  </View>
                ))}
              </View>
              <View className="flex-row gap-2">
                <TogglePill
                  label="AMRAP top set"
                  active={amrap}
                  onPress={() => setAmrap((v) => !v)}
                />
                <TogglePill
                  label="+ Deload week"
                  active={deload}
                  onPress={() => setDeload((v) => !v)}
                />
              </View>
              <Button
                label="Generate wave"
                leftIcon={
                  <Icon icon={Sparkles} size={18} color={colors.bg} />
                }
                onPress={generate}
              />
            </Card>

            {byWeek.length === 0 ? (
              <Text variant="caption">
                No prescriptions yet — generate a wave to fill the weeks.
              </Text>
            ) : (
              byWeek.map(([weekIndex, weekSets]) => (
                <View key={weekIndex} className="gap-2">
                  <Text variant="caption" className="uppercase tracking-wider">
                    Week {weekIndex}
                  </Text>
                  {weekSets.map((set) => (
                    <View
                      key={set.id}
                      className="flex-row items-center justify-between rounded-xl bg-surface-hi px-4 py-2.5"
                    >
                      <Text variant="label">
                        Set {set.setNumber} · {cellLabel(set)}
                      </Text>
                      <Pressable
                        onPress={() => removeProgramSet(set.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Remove set"
                        className="active:opacity-60"
                      >
                        <Icon icon={Trash2} size={16} color={colors.fgFaint} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** Small pill toggle for boolean wave options. */
function TogglePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="flex-1 rounded-xl border px-3 py-2.5 active:opacity-70"
      style={{
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primarySoft : 'transparent',
      }}
    >
      <Text
        variant="caption"
        style={{ color: active ? colors.primaryBright : colors.fgMuted }}
        className="text-center"
      >
        {label}
      </Text>
    </Pressable>
  );
}
