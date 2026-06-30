import {
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';

import { Button, Icon, Text, colors, tint } from '@/ui';

import type { ProgramWeekRow } from '../queries';

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
 * Mesocycle timeline — one row per week with a deload toggle. Weeks reorder via
 * up/down buttons (the editor scroller can't host a virtualized drag list here);
 * the per-exercise wave is authored in ProgramWaveEditor.
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
  function moveWeek(from: number, to: number) {
    if (to < 0 || to >= weeks.length) return;
    const ids = weeks.map((week) => week.id);
    const [moved] = ids.splice(from, 1);
    if (moved == null) return;
    ids.splice(to, 0, moved);
    onReorderWeeks(ids);
  }

  return (
    <View className="gap-3 rounded-2xl border border-border-soft bg-surface-alt/40 p-3">
      <Text variant="caption" className="uppercase tracking-wider">
        Mesocycle · {weeks.length} {weeks.length === 1 ? 'week' : 'weeks'}
      </Text>

      {weeks.map((week, index) => (
        <View key={week.id} className="flex-row items-center gap-2">
          <View className="flex-row items-center">
            <Pressable
              onPress={() => moveWeek(index, index - 1)}
              disabled={index === 0}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Move week up"
              className="active:opacity-60"
              style={index === 0 ? { opacity: 0.25 } : undefined}
            >
              <Icon icon={ChevronUp} size={18} color={colors.fgFaint} />
            </Pressable>
            <Pressable
              onPress={() => moveWeek(index, index + 1)}
              disabled={index === weeks.length - 1}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Move week down"
              className="active:opacity-60"
              style={index === weeks.length - 1 ? { opacity: 0.25 } : undefined}
            >
              <Icon icon={ChevronDown} size={18} color={colors.fgFaint} />
            </Pressable>
          </View>
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
              style={{ color: week.isDeload ? colors.warning : colors.fgMuted }}
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
