import { Stack, useRouter } from 'expo-router';
import { CalendarClock } from 'lucide-react-native';
import { Pressable, ScrollView } from 'react-native';

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
    <Screen>
      <Stack.Screen options={{ title: 'History' }} />
      {sessions.length === 0 ? (
        <EmptyState
          icon={<Icon icon={CalendarClock} size={40} color={colors.fgFaint} />}
          title="No workouts logged"
          description="Finished workouts will show up here."
        />
      ) : (
        <ScrollView contentContainerClassName="gap-3 p-5">
          {sessions.map((session) => (
            <Pressable
              key={session.id}
              onPress={() => openSession(session.id)}
              className="active:opacity-70"
            >
              <Card className="flex-row items-center justify-between">
                <Text variant="heading">
                  {session.routineName ?? 'Freestyle'}
                </Text>
                <Text variant="muted">
                  {session.finishedAt
                    ? formatRelativeDate(session.finishedAt)
                    : ''}
                </Text>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
