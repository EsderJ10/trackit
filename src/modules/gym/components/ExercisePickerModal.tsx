import { X } from 'lucide-react-native';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text, colors } from '@/ui';

import type { Exercise } from '../schema';
import { useExercises } from '../queries';

export interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}

/** Bottom-sheet-style catalog picker, grouped by muscle group. */
export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
}: ExercisePickerModalProps) {
  const { data: exercises } = useExercises();

  const groups = useMemo(() => {
    const byMuscle = new Map<string, Exercise[]>();
    for (const exercise of exercises) {
      const list = byMuscle.get(exercise.muscleGroup) ?? [];
      list.push(exercise);
      byMuscle.set(exercise.muscleGroup, list);
    }
    return [...byMuscle.entries()];
  }, [exercises]);

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
          style={{ backgroundColor: colors.surface, maxHeight: '85%' }}
        >
          <View className="flex-row items-center justify-between border-b border-border-soft p-4">
            <Text variant="heading">Add exercise</Text>
            <Pressable onPress={onClose} hitSlop={8} className="active:opacity-60">
              <Icon icon={X} size={22} color={colors.fgMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="p-4 gap-4">
            {groups.map(([muscle, list]) => (
              <View key={muscle} className="gap-2">
                <Text variant="caption" className="uppercase tracking-wider">
                  {muscle}
                </Text>
                {list.map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    onPress={() => {
                      onSelect(exercise);
                      onClose();
                    }}
                    className="rounded-xl bg-surface-hi px-4 py-3 active:opacity-70"
                  >
                    <Text variant="label">{exercise.name}</Text>
                    {exercise.equipment ? (
                      <Text variant="caption" className="mt-0.5">
                        {exercise.equipment}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
