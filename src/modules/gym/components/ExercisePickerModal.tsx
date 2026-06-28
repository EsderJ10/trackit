import { X } from 'lucide-react-native';
import { useMemo } from 'react';
import { Modal, Pressable, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text, colors } from '@/ui';

import type { Exercise } from '../schema';
import { useExercises } from '../queries';

export interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}

interface ExerciseSection {
  title: string;
  data: Exercise[];
}

/** Bottom-sheet-style catalog picker, grouped by muscle group. */
export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
}: ExercisePickerModalProps) {
  const { data: exercises } = useExercises();

  const sections = useMemo<ExerciseSection[]>(() => {
    const byMuscle = new Map<string, Exercise[]>();
    const order: string[] = [];
    for (const exercise of exercises) {
      let list = byMuscle.get(exercise.muscleGroup);
      if (!list) {
        list = [];
        byMuscle.set(exercise.muscleGroup, list);
        order.push(exercise.muscleGroup);
      }
      list.push(exercise);
    }
    return order.map((muscle) => ({
      title: muscle,
      data: byMuscle.get(muscle)!,
    }));
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
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              className="active:opacity-60"
            >
              <Icon icon={X} size={22} color={colors.fgMuted} />
            </Pressable>
          </View>

          <SectionList
            sections={sections}
            keyExtractor={(exercise) => String(exercise.id)}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ padding: 16 }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            renderSectionHeader={({ section }) => (
              <View className="bg-surface pb-2 pt-4">
                <Text variant="caption" className="uppercase tracking-wider">
                  {section.title}
                </Text>
              </View>
            )}
            renderItem={({ item: exercise }) => (
              <Pressable
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
            )}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
