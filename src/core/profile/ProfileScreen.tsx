import { UserRound } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { useSessionStore } from '@/core/auth/session-store';
import { MODULES } from '@/core/module-registry';
import { Avatar, Card, EmptyState, Icon, Screen, Text, colors } from '@/ui';

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="caption" className="uppercase tracking-wider">
      {children}
    </Text>
  );
}

export function ProfileScreen() {
  const user = useSessionStore((state) => state.user);

  if (!user) {
    return (
      <Screen edges={['top']}>
        <EmptyState
          icon={<Icon icon={UserRound} size={40} color={colors.fgFaint} />}
          title="Not signed in"
          description="Sign in to see your profile and stats."
        />
      </Screen>
    );
  }

  const name = user.displayName ?? user.username;

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-5 p-5"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="display">Profile</Text>

        <Card className="flex-row items-center gap-4">
          <Avatar name={name} />
          <View className="flex-1 gap-0.5">
            <Text variant="title">{name}</Text>
            <Text variant="muted">@{user.username}</Text>
            {user.email ? <Text variant="muted">{user.email}</Text> : null}
            <Text variant="caption" className="mt-1">
              Member since{' '}
              {user.createdAt.toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </Card>

        {MODULES.map((module) => {
          const Widget = module.ProfileWidget;
          if (!Widget) return null;
          return (
            <View key={module.meta.id} className="gap-2">
              <SectionLabel>{module.meta.name}</SectionLabel>
              <Widget moduleId={module.meta.id} />
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
