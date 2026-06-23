import { Plus, Trash2 } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';

import { Button, Icon, Text, colors } from '@/ui';

import type { ProgramWeekRow } from '../queries';

export interface ProgramWeekSectionProps {
  weeks: ProgramWeekRow[];
  onAddWeek: () => void;
  onRenameWeek: (weekId: number, name: string) => void;
  onToggleDeload: (weekId: number, isDeload: boolean) => void;
  onRemoveWeek: (weekId: number) => void;
}

/**
 * The program's mesocycle timeline — one row per week with a deload toggle. The
 * descending-RIR / set-ramp wave is authored per exercise (see ProgramWaveEditor);
 * this section just controls how many weeks the cycle runs and which is a deload.
 */
export function ProgramWeekSection({
  weeks,
  onAddWeek,
  onRenameWeek,
  onToggleDeload,
  onRemoveWeek,
}: ProgramWeekSectionProps) {
  return (
    <View className="gap-3 rounded-2xl border border-border-soft bg-surface-alt/40 p-3">
      <Text variant="caption" className="uppercase tracking-wider">
        Mesocycle · {weeks.length} {weeks.length === 1 ? 'week' : 'weeks'}
      </Text>

      {weeks.map((week) => (
        <View key={week.id} className="flex-row items-center gap-2">
          <TextInput
            defaultValue={week.name ?? `Week ${week.weekIndex}`}
            placeholder={`Week ${week.weekIndex}`}
            placeholderTextColor={colors.fgFaint}
            onEndEditing={(event) =>
              onRenameWeek(week.id, event.nativeEvent.text)
            }
            className="flex-1 text-base font-medium text-fg"
          />
          <Pressable
            onPress={() => onToggleDeload(week.id, !week.isDeload)}
            className="rounded-lg border px-3 py-1.5 active:opacity-70"
            style={{
              borderColor: week.isDeload ? colors.warning : colors.border,
              backgroundColor: week.isDeload
                ? `${colors.warning}22`
                : 'transparent',
            }}
          >
            <Text
              variant="caption"
              style={{
                color: week.isDeload ? colors.warning : colors.fgMuted,
              }}
            >
              Deload
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onRemoveWeek(week.id)}
            hitSlop={8}
            className="active:opacity-60"
          >
            <Icon icon={Trash2} size={18} color={colors.fgFaint} />
          </Pressable>
        </View>
      ))}

      <Button
        label="Add week"
        variant="secondary"
        size="md"
        leftIcon={<Icon icon={Plus} size={18} color={colors.fg} />}
        onPress={onAddWeek}
      />
    </View>
  );
}
