import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Dumbbell, Search, Star, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Card, EmptyState, Icon, Screen, Text, colors, tint } from '@/ui';

import { muscleLabel } from '../muscles';
import { useExercises, useRecentExerciseIds } from '../queries';
import type { Exercise } from '../schema';

interface MuscleSection {
  name: string;
  exercises: Exercise[];
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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="rounded-full border px-3 py-1.5 active:opacity-70"
      style={{
        backgroundColor: active ? colors.gym : 'transparent',
        borderColor: active ? colors.gym : colors.borderSoft,
      }}
    >
      <Text
        variant="caption"
        className="uppercase tracking-wider"
        style={{ color: active ? colors.bg : colors.fgMuted }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A single exercise row: accent medallion, name, worked-muscle subtitle. */
function ExerciseRow({
  exercise,
  onPress,
}: {
  exercise: Exercise;
  onPress: () => void;
}) {
  const subtitle =
    exercise.primaryMuscles && exercise.primaryMuscles.length > 0
      ? exercise.primaryMuscles.map(muscleLabel).join(' · ')
      : (exercise.equipment ?? exercise.muscleGroup);

  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      <Card className="flex-row items-center gap-3">
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
      </Card>
    </Pressable>
  );
}

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

  const filteredGroups = useMemo(() => groupByMuscle(filtered), [filtered]);
  const allGroups = useMemo(() => groupByMuscle(exercises), [exercises]);

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

  function openExercise(exerciseId: number) {
    router.push({
      pathname: '/modules/gym/exercise',
      params: { exerciseId: String(exerciseId) },
    });
  }

  function clearFilters() {
    setQuery('');
    setMuscleFilter(null);
    setEquipmentFilter(null);
  }

  const renderSection = (title: string, items: Exercise[]) => (
    <View key={title} className="gap-2">
      <Text variant="caption" className="uppercase tracking-wider">
        {title}
      </Text>
      {items.map((exercise) => (
        <ExerciseRow
          key={exercise.id}
          exercise={exercise}
          onPress={() => openExercise(exercise.id)}
        />
      ))}
    </View>
  );

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

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Exercises' }} />
      <ScrollView
        contentContainerClassName="gap-4 p-5"
        keyboardShouldPersistTaps="handled"
      >
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
                setEquipmentFilter((current) =>
                  current === item ? null : item,
                )
              }
            />
          ))}
        </ScrollView>

        {isFiltering ? (
          filtered.length === 0 ? (
            <View className="gap-3 px-1 pt-2">
              <Text variant="muted">No exercises match your filters.</Text>
              <Pressable onPress={clearFilters} className="active:opacity-70">
                <Text variant="label" style={{ color: colors.gym }}>
                  Clear filters
                </Text>
              </Pressable>
            </View>
          ) : (
            filteredGroups.map((group) =>
              renderSection(group.name, group.exercises),
            )
          )
        ) : (
          <>
            {favorites.length > 0
              ? renderSection('Favorites', favorites)
              : null}
            {recents.length > 0 ? renderSection('Recent', recents) : null}
            {allGroups.map((group) =>
              renderSection(group.name, group.exercises),
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
