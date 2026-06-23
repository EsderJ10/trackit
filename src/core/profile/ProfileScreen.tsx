import { useRouter } from 'expo-router';
import { Settings as SettingsIcon, UserRound } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { useSessionStore } from '@/core/auth/session-store';
import { MODULES } from '@/core/module-registry';
import {
  Avatar,
  Card,
  EmptyState,
  Icon,
  Screen,
  Section,
  Text,
  colors,
} from '@/ui';

export function ProfileScreen() {
  const router = useRouter();
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
        <View className="flex-row items-center justify-between">
          <Text variant="display">Profile</Text>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70"
          >
            <Icon icon={SettingsIcon} size={20} color={colors.fgMuted} />
          </Pressable>
        </View>

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
            <Section key={module.meta.id} title={module.meta.name}>
              <Widget moduleId={module.meta.id} />
            </Section>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
