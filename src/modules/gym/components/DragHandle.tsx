import * as Haptics from 'expo-haptics';
import { GripVertical } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useReorderableDrag } from 'react-native-reorderable-list';

import { Icon, colors } from '@/ui';

/**
 * The grip that starts a drag-reorder. It must be rendered inside a
 * (Nested)ReorderableList item so `useReorderableDrag` can resolve its row.
 * A short long-press grabs the row — slightly delayed to forgive stray taps —
 * and a haptic confirms the grab.
 */
export function DragHandle() {
  const drag = useReorderableDrag();
  return (
    <Pressable
      onLongPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        drag();
      }}
      delayLongPress={180}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Hold and drag to reorder"
      className="px-1 py-1 active:opacity-60"
    >
      <Icon icon={GripVertical} size={18} color={colors.fgFaint} />
    </Pressable>
  );
}
