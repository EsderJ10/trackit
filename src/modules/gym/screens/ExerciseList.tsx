import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Dumbbell, Search, Star, X } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  TextInput,
  View,
} from 'react-native';

import {
  Chip,
  EmptyState,
  Icon,
  PressableCard,
  Screen,
  Text,
  colors,
  tint,
} from '@/ui';

import { muscleLabel } from '../muscles';
import { useExercises, useRecentExerciseIds } from '../queries';
import type { Exercise } from '../schema';

interface MuscleSection {
  name: string;
  exercises: Exercise[];
}

/** A flattened section row; the key namespaces the exercise by its section so the
    same exercise can appear under Favorites/Recent and its muscle group. */
interface ExerciseRowItem {
  key: string;
  exercise: Exercise;
}

interface ExerciseSection {
  title: string;
  data: ExerciseRowItem[];
}

/** Bucket a (muscle-group, name)-ordered list into per-group sections. */
function groupByMuscle(list: Exercise[]): MuscleSection[] {
  const byName = new Map<string, MuscleSection>();
  const order: string[] = [];
  for (const exercise of list) {
    let group = byName.get(exercise.muscleGroup);
    if (!group) {
      group = { name: exercise.muscleGroup, exercises: [] };
      byName.set(exercise.muscleGroup, group);
      order.push(exercise.muscleGroup);
    }
    group.exercises.push(exercise);
  }
  return order.map((name) => byName.get(name)!);
}

/** Wrap a group's exercises as section rows with section-namespaced keys. */
function toSection(title: string, exercises: Exercise[]): ExerciseSection {
  return {
    title,
    data: exercises.map((exercise) => ({
      key: `${title}-${exercise.id}`,
      exercise,
    })),
  };
}

/** A selectable pill for the muscle-group / equipment filter bars. */
function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Chip active={active} accent={colors.gym} onPress={onPress}>
      <Text
        variant="caption"
        className="uppercase tracking-wider"
        style={{ color: active ? colors.bg : colors.fgMuted }}
      >
        {label}
      </Text>
    </Chip>
  );
}

/** A single exercise row: accent medallion, name, worked-muscle subtitle. */
const ExerciseRow = memo(function ExerciseRow({
  exercise,
  onPress,
}: {
  exercise: Exercise;
  onPress: (exerciseId: number) => void;
}) {
  const subtitle =
    exercise.primaryMuscles && exercise.primaryMuscles.length > 0
      ? exercise.primaryMuscles.map(muscleLabel).join(' · ')
      : (exercise.equipment ?? exercise.muscleGroup);

  return (
    <PressableCard
      onPress={() => onPress(exercise.id)}
      accessibilityLabel={exercise.name}
      className="flex-row items-center gap-3"
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: tint(colors.gym, 0.13) }}
      >
        <Icon icon={Dumbbell} size={18} color={colors.gym} />
      </View>
      <View className="flex-1">
        <Text variant="body">{exercise.name}</Text>
        <Text variant="caption" className="text-fg-muted">
          {subtitle}
        </Text>
      </View>
      {exercise.isFavorite ? (
        <Icon icon={Star} size={16} color={colors.gym} fill={colors.gym} />
      ) : null}
      <Icon icon={ChevronRight} size={18} color={colors.fgFaint} />
    </PressableCard>
  );
});

export function ExerciseList() {
  const router = useRouter();
  const { data: exercises } = useExercises();
  const recentIds = useRecentExerciseIds();

  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null);

  const muscleGroups = useMemo(
    () => [...new Set(exercises.map((e) => e.muscleGroup))],
    [exercises],
  );
  const equipmentOptions = useMemo(
    () =>
      [
        ...new Set(exercises.map((e) => e.equipment).filter(Boolean)),
      ] as string[],
    [exercises],
  );

  const trimmedQuery = query.trim().toLowerCase();
  const isFiltering =
    trimmedQuery !== '' || muscleFilter !== null || equipmentFilter !== null;

  const filtered = useMemo(
    () =>
      exercises.filter(
        (e) =>
          (trimmedQuery === '' ||
            e.name.toLowerCase().includes(trimmedQuery)) &&
          (muscleFilter === null || e.muscleGroup === muscleFilter) &&
          (equipmentFilter === null || e.equipment === equipmentFilter),
      ),
    [exercises, trimmedQuery, muscleFilter, equipmentFilter],
  );

  const favorites = useMemo(
    () => exercises.filter((e) => e.isFavorite),
    [exercises],
  );
  const recents = useMemo(() => {
    const byId = new Map(exercises.map((e) => [e.id, e]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((e): e is Exercise => e !== undefined);
  }, [recentIds, exercises]);

  // Sections feed the SectionList: when filtering, just the matching groups;
  // otherwise Favorites + Recent pinned above the full muscle-grouped catalog.
  const sections = useMemo<ExerciseSection[]>(() => {
    if (isFiltering) {
      return groupByMuscle(filtered).map((g) => toSection(g.name, g.exercises));
    }
    const result: ExerciseSection[] = [];
    if (favorites.length > 0) result.push(toSection('Favorites', favorites));
    if (recents.length > 0) result.push(toSection('Recent', recents));
    for (const g of groupByMuscle(exercises)) {
      result.push(toSection(g.name, g.exercises));
    }
    return result;
  }, [isFiltering, filtered, favorites, recents, exercises]);

  const openExercise = useCallback(
    (exerciseId: number) => {
      router.push({
        pathname: '/modules/gym/exercise',
        params: { exerciseId: String(exerciseId) },
      });
    },
    [router],
  );

  function clearFilters() {
    setQuery('');
    setMuscleFilter(null);
    setEquipmentFilter(null);
  }

  // An empty catalog has nothing to search or filter — show the plain prompt
  // rather than an empty search bar over empty filter rows.
  if (exercises.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Exercises' }} />
        <EmptyState
          icon={<Icon icon={Dumbbell} size={40} color={colors.fgFaint} />}
          title="No exercises"
          description="Add exercises from a routine or workout to see them here."
        />
      </Screen>
    );
  }

  const listHeader = (
    <View className="gap-4 pb-2">
      {/* Search */}
      <View className="flex-row items-center gap-3 rounded-xl border border-border bg-surface-hi px-4 py-3.5">
        <Icon icon={Search} size={18} color={colors.fgFaint} />
        <TextInput
          className="flex-1 text-base text-fg"
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          placeholderTextColor={colors.fgFaint}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Icon icon={X} size={18} color={colors.fgFaint} />
          </Pressable>
        ) : null}
      </View>

      {/* Muscle-group filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pr-2"
      >
        <FilterChip
          label="All"
          active={muscleFilter === null}
          onPress={() => setMuscleFilter(null)}
        />
        {muscleGroups.map((group) => (
          <FilterChip
            key={group}
            label={group}
            active={muscleFilter === group}
            onPress={() =>
              setMuscleFilter((current) => (current === group ? null : group))
            }
          />
        ))}
      </ScrollView>

      {/* Equipment filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pr-2"
      >
        <FilterChip
          label="Any gear"
          active={equipmentFilter === null}
          onPress={() => setEquipmentFilter(null)}
        />
        {equipmentOptions.map((item) => (
          <FilterChip
            key={item}
            label={item}
            active={equipmentFilter === item}
            onPress={() =>
              setEquipmentFilter((current) => (current === item ? null : item))
            }
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Exercises' }} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={listHeader}
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderSectionHeader={({ section }) => (
          <View className="bg-bg pb-2 pt-4">
            <Text variant="caption" className="uppercase tracking-wider">
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ExerciseRow exercise={item.exercise} onPress={openExercise} />
        )}
        ListEmptyComponent={
          <View className="gap-3 px-1 pt-2">
            <Text variant="muted">No exercises match your filters.</Text>
            <Pressable
              onPress={clearFilters}
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
              className="active:opacity-70"
            >
              <Text variant="label" style={{ color: colors.gym }}>
                Clear filters
              </Text>
            </Pressable>
          </View>
        }
      />
    </Screen>
  );
}
