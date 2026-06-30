import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text, TextField, colors } from '@/ui';

import type { Exercise } from '../schema';
import { useExercises, useRecentExercises } from '../queries';

export interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}

interface ExerciseSection {
  title: string;
  data: Exercise[];
}

/**
 * Bottom-sheet-style catalog picker. Empty query shows Favorites + Recent
 * shortcuts above the muscle-group groups; typing filters the whole catalog by
 * name or equipment.
 */
export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
}: ExercisePickerModalProps) {
  const { data: exercises } = useExercises();
  const { data: recent } = useRecentExercises(8);
  const [query, setQuery] = useState('');

  function close() {
    setQuery('');
    onClose();
  }

  const sections = useMemo<ExerciseSection[]>(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const matches = exercises.filter(
        (exercise) =>
          exercise.name.toLowerCase().includes(q) ||
          (exercise.equipment?.toLowerCase().includes(q) ?? false),
      );
      return matches.length > 0 ? [{ title: 'Results', data: matches }] : [];
    }

    const result: ExerciseSection[] = [];
    const favorites = exercises.filter((exercise) => exercise.isFavorite);
    if (favorites.length > 0)
      result.push({ title: 'Favorites', data: favorites });
    if (recent.length > 0) result.push({ title: 'Recent', data: recent });

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
    for (const muscle of order) {
      result.push({ title: muscle, data: byMuscle.get(muscle)! });
    }
    return result;
  }, [exercises, recent, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <View className="flex-1 justify-end bg-black/60">
        <SafeAreaView
          edges={['bottom']}
          style={{ backgroundColor: colors.surface, maxHeight: '85%' }}
        >
          <View className="flex-row items-center justify-between border-b border-border-soft p-4">
            <Text variant="heading">Add exercise</Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              className="active:opacity-60"
            >
              <Icon icon={X} size={22} color={colors.fgMuted} />
            </Pressable>
          </View>

          <View className="px-4 pt-3">
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search exercises"
            />
          </View>

          <SectionList
            sections={sections}
            // Dedupe across sections (an exercise can appear in Recent and its
            // muscle group) by folding the section index into the key.
            keyExtractor={(exercise, index) => `${exercise.id}:${index}`}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ padding: 16 }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            ListEmptyComponent={
              <Text variant="muted" className="px-1 pt-4">
                No exercises match “{query.trim()}”.
              </Text>
            }
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
                  close();
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
