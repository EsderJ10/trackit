import { Link } from 'expo-router';
import { LayoutDashboard } from 'lucide-react-native';
import { Pressable, ScrollView } from 'react-native';

import { MODULES } from '@/core/module-registry';
import { EmptyState, Icon, Text, colors } from '@/ui';

/**
 * The dynamic dashboard. Renders one widget per registered module, driven
 * entirely by the module registry — adding/removing a module here requires no
 * changes to this file.
 */
export function Dashboard() {
  if (MODULES.length === 0) {
    return (
      <EmptyState
        icon={<Icon icon={LayoutDashboard} size={40} color={colors.fgFaint} />}
        title="No modules yet"
        description="Tracking modules will appear here as you add them."
      />
    );
  }

  return (
    <ScrollView
      contentContainerClassName="gap-4 p-5"
      showsVerticalScrollIndicator={false}
    >
      <Text variant="display">Dashboard</Text>
      {MODULES.map((module) => (
        <Link
          key={module.meta.id}
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
      ))}
    </ScrollView>
  );
}
