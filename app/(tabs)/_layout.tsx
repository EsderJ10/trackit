import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { LayoutDashboard, UserRound } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MODULES } from '@/core/module-registry';
import { Icon, Text, cn, colors, glow } from '@/ui';

function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingBottom: insets.bottom }}
      className="border-t border-border bg-surface"
    >
      {/* Modules contribute persistent bars (e.g. resume-workout) above the tabs. */}
      {MODULES.flatMap((module) => {
        const Bar = module.GlobalBar;
        return Bar ? [<Bar key={module.meta.id} />] : [];
      })}
      <View className="flex-row px-2 pt-2">
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          const { options } = descriptor;
          const focused = state.index === index;
          const color = focused ? colors.primaryBright : colors.fgFaint;
          const label =
            typeof options.title === 'string' ? options.title : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              className="flex-1 items-center gap-1"
            >
              <View
                style={focused ? glow(colors.primaryGlow, 0.45) : undefined}
                className={cn(
                  'items-center justify-center rounded-2xl px-5 py-1.5',
                  focused && 'bg-surface-hi',
                )}
              >
                {options.tabBarIcon?.({ focused, color, size: 22 })}
              </View>
              <Text variant="caption" style={{ color }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  // Modules contribute their own primary tabs via registry metadata; the route
  // files are physical.
  const moduleTabs = MODULES.flatMap((module) => module.primaryTabs ?? []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Icon icon={LayoutDashboard} color={color} size={size} />
          ),
        }}
      />
      {moduleTabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Icon icon={tab.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon icon={UserRound} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
