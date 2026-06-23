import { useRouter } from 'expo-router';
import { CalendarClock, ChevronRight } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

import { formatRelativeDate } from '../format';
import { useFinishedSessions } from '../queries';

export function History() {
  const router = useRouter();
  const { data: sessions } = useFinishedSessions();

  function openSession(sessionId: number) {
    router.push({
      pathname: '/modules/gym/session',
      params: { sessionId: String(sessionId) },
    });
  }

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
        <ScrollView
          contentContainerClassName="gap-3 p-5"
          showsVerticalScrollIndicator={false}
        >
          {sessions.map((session) => (
            <Pressable
              key={session.id}
              onPress={() => openSession(session.id)}
              className="active:opacity-70"
            >
              <Card className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text variant="heading">
                    {session.routineName ?? 'Freestyle'}
                  </Text>
                  <Text variant="caption" className="mt-0.5">
                    {session.finishedAt
                      ? formatRelativeDate(session.finishedAt)
                      : ''}
                  </Text>
                </View>
                <Icon icon={ChevronRight} size={18} color={colors.fgFaint} />
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
