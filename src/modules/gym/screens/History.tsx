import { useRouter } from 'expo-router';
import { CalendarClock, ChevronRight } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

import { formatRelativeDate } from '../format';
import { useFinishedSessions, type SessionSummary } from '../queries';
import { sessionLabel } from '../session-label';

/** One finished-workout row; memoized so the virtualized list reuses cells. */
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

  const openSession = useCallback(
    (sessionId: number) => {
      router.push({
        pathname: '/modules/gym/session',
        params: { sessionId: String(sessionId) },
      });
    },
    [router],
  );

  return (
    <Screen edges={['top']}>
      <View className="px-5 pt-5">
        <Text variant="display">History</Text>
      </View>
      {sessions.length === 0 ? (
        <EmptyState
          icon={<Icon icon={CalendarClock} size={40} color={colors.fgFaint} />}
          title="No workouts logged"
          description="Finished workouts will show up here."
        />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(session) => String(session.id)}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <HistoryRow session={item} onPress={openSession} />
          )}
        />
      )}
    </Screen>
  );
}
