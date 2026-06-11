import { Tabs } from 'expo-router';
import { LayoutDashboard, Settings } from 'lucide-react-native';

import { Icon, colors } from '@/ui';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryBright,
        tabBarInactiveTintColor: colors.fgFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Icon icon={LayoutDashboard} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Icon icon={Settings} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
