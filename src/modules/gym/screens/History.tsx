import { Stack } from 'expo-router';
import { CalendarClock } from 'lucide-react-native';
import { ScrollView } from 'react-native';

import { Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

import { formatRelativeDate } from '../format';
import { useFinishedSessions } from '../queries';

export function History() {
  const { data: sessions } = useFinishedSessions();

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
            <Card
              key={session.id}
              className="flex-row items-center justify-between"
            >
              <Text variant="heading">
                {session.routineName ?? 'Freestyle'}
              </Text>
              <Text variant="muted">
                {session.finishedAt
                  ? formatRelativeDate(session.finishedAt)
                  : ''}
              </Text>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
