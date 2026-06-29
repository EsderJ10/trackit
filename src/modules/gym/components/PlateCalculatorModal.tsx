import { X } from 'lucide-react-native';
import { useMemo } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WeightUnit } from '@/core/settings/schema';
import { Icon, Text, colors } from '@/ui';

import {
  DEFAULT_BAR,
  DEFAULT_PLATES,
  platesPerSide,
  summarisePlates,
} from '../plate-math';

export interface PlateCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  /** Target total weight in the DISPLAY unit (what the lifter sees on the bar). */
  targetDisplay: number | null;
  unit: WeightUnit;
}

/** Per-side plate breakdown for a target weight, with a closest-possible note. */
export function PlateCalculatorModal({
  visible,
  onClose,
  targetDisplay,
  unit,
}: PlateCalculatorModalProps) {
  const bar = DEFAULT_BAR[unit];
  const plan = useMemo(
    () =>
      targetDisplay == null
        ? null
        : platesPerSide(targetDisplay, bar, DEFAULT_PLATES[unit]),
    [targetDisplay, bar, unit],
  );
  const summary = useMemo(
    () => (plan ? summarisePlates(plan.plates) : []),
    [plan],
  );

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
          style={{ backgroundColor: colors.surface }}
        >
          <View className="flex-row items-center justify-between border-b border-border-soft p-4">
            <View>
              <Text variant="heading">Plates per side</Text>
              {targetDisplay != null ? (
                <Text variant="caption" className="mt-0.5">
                  {targetDisplay} {unit} · {bar} {unit} bar
                </Text>
              ) : null}
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

          <View className="gap-3 p-5">
            {plan == null || summary.length === 0 ? (
              <Text variant="muted">Just the bar — no plates needed.</Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {summary.map(({ plate, count }) => (
                  <View
                    key={plate}
                    className="rounded-xl border border-primary bg-surface-hi px-4 py-3"
                  >
                    <Text
                      variant="heading"
                      style={{ color: colors.primaryBright }}
                    >
                      {count} × {plate}
                    </Text>
                    <Text variant="caption">{unit} / side</Text>
                  </View>
                ))}
              </View>
            )}
            {plan && !plan.exact ? (
              <Text variant="caption" style={{ color: colors.warning }}>
                Closest loadable is {plan.achieved} {unit} with your plates.
              </Text>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
