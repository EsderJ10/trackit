import { Link, useRouter } from 'expo-router';
import {
  LayoutDashboard,
  Settings as SettingsIcon,
  SlidersHorizontal,
} from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { MODULES, getModule } from '@/core/module-registry';
import type { TrackerModule } from '@/core/types/module';
import { useDashboardLayout } from '@/core/settings/use-settings';
import { Card, EmptyState, Icon, Text, colors } from '@/ui';

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: typeof SettingsIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70"
    >
      <Icon icon={icon} size={20} color={colors.fgMuted} />
    </Pressable>
  );
}

/** Render one module's dashboard widget, honoring the self-navigating rule. */
function ModuleWidget({ module }: { module: TrackerModule }) {
  // Modules with their own primary tabs are self-navigating (their widgets own
  // their CTAs); simpler modules link to the generic module screen.
  if (module.primaryTabs?.length) {
    return <module.DashboardWidget moduleId={module.meta.id} />;
  }
  return (
    <Link
      href={{
        pathname: '/modules/[moduleId]',
        params: { moduleId: module.meta.id },
      }}
      asChild
    >
      <Pressable className="active:opacity-80">
        <module.DashboardWidget moduleId={module.meta.id} />
      </Pressable>
    </Link>
  );
}

/**
 * The dynamic home screen. Renders module widgets per the user's saved layout
 * (order + visibility), driven entirely by the module registry.
 */
export function Dashboard() {
  const router = useRouter();
  const layout = useDashboardLayout();

  if (MODULES.length === 0) {
    return (
      <EmptyState
        icon={<Icon icon={LayoutDashboard} size={40} color={colors.fgFaint} />}
        title="No modules yet"
        description="Tracking modules will appear here as you add them."
      />
    );
  }

  // One-time read of the clock for the greeting + date header.
  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const visible = layout
    .filter((entry) => !entry.hidden)
    .map((entry) => getModule(entry.moduleId))
    .filter((module): module is TrackerModule => module !== undefined);

  return (
    <ScrollView
      contentContainerClassName="gap-4 p-5"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text variant="display">{greeting}</Text>
          <Text variant="muted" className="mt-1">
            {dateLabel}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <HeaderButton
            icon={SlidersHorizontal}
            label="Customize home"
            onPress={() => router.push('/dashboard')}
          />
          <HeaderButton
            icon={SettingsIcon}
            label="Settings"
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>

      {visible.length === 0 ? (
        <Pressable onPress={() => router.push('/dashboard')}>
          <Card className="items-center gap-2 py-8">
            <Icon icon={SlidersHorizontal} size={32} color={colors.fgFaint} />
            <Text variant="heading">Your home is empty</Text>
            <Text variant="muted" className="text-center">
              Tap to customize and choose which widgets to show.
            </Text>
          </Card>
        </Pressable>
      ) : (
        visible.map((module) => (
          <ModuleWidget key={module.meta.id} module={module} />
        ))
      )}
    </ScrollView>
  );
}
