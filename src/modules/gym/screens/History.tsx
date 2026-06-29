import { useRouter } from 'expo-router';
import { ChevronRight, TrendingUp } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';

import { Card, Icon, Screen, Text, colors } from '@/ui';

import {
  addMonths,
  groupSessionDays,
  startOfDay,
  startOfMonth,
} from '../calendar';
import { WorkoutCalendar } from '../components/WorkoutCalendar';
import { formatRelativeDate } from '../format';
import {
  startWorkout,
  useFinishedSessions,
  type SessionSummary,
} from '../queries';
import { sessionLabel } from '../session-label';

// memoized so the virtualized list reuses cells.
const HistoryRow = memo(function HistoryRow({
  session,
  onPress,
}: {
  session: SessionSummary;
  onPress: (sessionId: number) => void;
}) {
  const label = sessionLabel(session);
  return (
    <Pressable
      onPress={() => onPress(session.id)}
      className="active:opacity-70"
    >
      <Card className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text variant="heading">{label.title}</Text>
          <Text variant="caption" className="mt-0.5">
            {[
              label.subtitle,
              session.finishedAt
                ? formatRelativeDate(session.finishedAt)
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <Icon icon={ChevronRight} size={18} color={colors.fgFaint} />
      </Card>
    </Pressable>
  );
});

export function History() {
  const router = useRouter();
  const { data: sessions } = useFinishedSessions();
  const [monthOffset, setMonthOffset] = useState(0);

  const openSession = useCallback(
    (sessionId: number) => {
      router.push({
        pathname: '/modules/gym/session',
        params: { sessionId: String(sessionId) },
      });
    },
    [router],
  );

  const cal = useMemo(() => {
    // Intentional current-time read for "today"; recomputes when sessions change.
    const now = new Date();
    return {
      todayStartMs: startOfDay(now).getTime(),
      currentMonth: startOfMonth(now),
      marked: groupSessionDays(sessions),
    };
  }, [sessions]);

  const displayMonth = addMonths(cal.currentMonth, monthOffset);

  const selectDay = useCallback(
    (date: Date, sessionIds: number[]) => {
      if (sessionIds.length > 0) {
        openSession(sessionIds[0]!);
        return;
      }
      const label = date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
      Alert.alert(
        'Log past workout',
        `Start a freestyle workout dated ${label}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log workout',
            onPress: () => {
              const noon = new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
                12,
              ).getTime();
              const sessionId = startWorkout(undefined, noon);
              router.push({
                pathname: '/modules/gym/workout',
                params: { sessionId: String(sessionId) },
              });
            },
          },
        ],
      );
    },
    [openSession, router],
  );

  const header = (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text variant="display">History</Text>
        <Pressable
          onPress={() => router.push('/modules/gym/progress')}
          accessibilityRole="button"
          accessibilityLabel="View progress trends"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-xl bg-surface-hi active:opacity-70"
        >
          <Icon icon={TrendingUp} size={20} color={colors.gym} />
        </Pressable>
      </View>
      <WorkoutCalendar
        month={displayMonth}
        marked={cal.marked}
        todayStartMs={cal.todayStartMs}
        canGoNext={monthOffset < 0}
        onPrev={() => setMonthOffset((offset) => offset - 1)}
        onNext={() => setMonthOffset((offset) => Math.min(0, offset + 1))}
        onSelectDay={selectDay}
      />
    </View>
  );

  return (
    <Screen edges={['top']}>
      <FlatList
        data={sessions}
        keyExtractor={(session) => String(session.id)}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: 12 }}
        ListEmptyComponent={
          <Text variant="muted" className="px-1">
            No workouts logged yet — tap a day above to log one.
          </Text>
        }
        renderItem={({ item }) => (
          <HistoryRow session={item} onPress={openSession} />
        )}
      />
    </Screen>
  );
}
