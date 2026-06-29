import { Copy, Plus, Trash2 } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';
import {
  NestedReorderableList,
  type ReorderableListReorderEvent,
  reorderItems,
} from 'react-native-reorderable-list';

import { Button, Icon, Text, colors, tint } from '@/ui';

import type { ProgramWeekRow } from '../queries';
import { DragHandle } from './DragHandle';

export interface ProgramWeekSectionProps {
  weeks: ProgramWeekRow[];
  onAddWeek: () => void;
  onRenameWeek: (weekId: number, name: string) => void;
  onToggleDeload: (weekId: number, isDeload: boolean) => void;
  onDuplicateWeek: (weekId: number) => void;
  onRemoveWeek: (weekId: number) => void;
  /** Persist a new week order (week row ids, top to bottom). */
  onReorderWeeks: (orderedIds: number[]) => void;
}

/**
 * Mesocycle timeline — one draggable row per week with a deload toggle. Controls
 * how many weeks the cycle runs; the per-exercise wave is authored in
 * ProgramWaveEditor.
 */
export function ProgramWeekSection({
  weeks,
  onAddWeek,
  onRenameWeek,
  onToggleDeload,
  onDuplicateWeek,
  onRemoveWeek,
  onReorderWeeks,
}: ProgramWeekSectionProps) {
  return (
    <View className="gap-3 rounded-2xl border border-border-soft bg-surface-alt/40 p-3">
      <Text variant="caption" className="uppercase tracking-wider">
        Mesocycle · {weeks.length} {weeks.length === 1 ? 'week' : 'weeks'}
      </Text>

      {weeks.length > 0 ? (
        <NestedReorderableList
          data={weeks}
          scrollable={false}
          keyExtractor={(week) => String(week.id)}
          onReorder={({ from, to }: ReorderableListReorderEvent) =>
            onReorderWeeks(reorderItems(weeks, from, to).map((week) => week.id))
          }
          renderItem={({ item: week }) => (
            <View className="flex-row items-center gap-2 pb-2">
              <DragHandle />
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
                accessibilityRole="button"
                accessibilityState={{ selected: week.isDeload }}
                className="rounded-lg border px-3 py-1.5 active:opacity-70"
                style={{
                  borderColor: week.isDeload ? colors.warning : colors.border,
                  backgroundColor: week.isDeload
                    ? tint(colors.warning, 0.13)
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
                onPress={() => onDuplicateWeek(week.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Duplicate week"
                className="active:opacity-60"
              >
                <Icon icon={Copy} size={18} color={colors.fgFaint} />
              </Pressable>
              <Pressable
                onPress={() => onRemoveWeek(week.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Remove week"
                className="active:opacity-60"
              >
                <Icon icon={Trash2} size={18} color={colors.fgFaint} />
              </Pressable>
            </View>
          )}
        />
      ) : null}

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
