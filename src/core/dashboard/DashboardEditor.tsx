import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { getModule } from '@/core/module-registry';
import {
  setDashboardLayout,
  useDashboardLayout,
} from '@/core/settings/use-settings';
import { Card, Icon, Screen, Text, colors } from '@/ui';

import { moveEntry, toggleHidden } from './layout';

function IconButton({
  icon,
  label,
  onPress,
  disabled,
  tint = colors.fgMuted,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-9 w-9 items-center justify-center rounded-xl bg-surface-hi active:opacity-70"
      style={disabled ? { opacity: 0.35 } : undefined}
    >
      <Icon icon={icon} size={18} color={tint} />
    </Pressable>
  );
}

/**
 * Customize which module widgets show on Home and in what order. Operates
 * directly on the persisted layout (live query re-renders after each change).
 */
export function DashboardEditor() {
  const router = useRouter();
  const layout = useDashboardLayout();

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-5 p-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <Text variant="display">Customize</Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70"
          >
            <Icon icon={X} size={20} color={colors.fgMuted} />
          </Pressable>
        </View>

        <Text variant="muted">
          Reorder your home widgets and choose which ones to show.
        </Text>

        <View className="gap-3">
          {layout.map((entry, index) => {
            const module = getModule(entry.moduleId);
            if (!module) return null;
            const { name, icon, color } = module.meta;
            return (
              <Card
                key={entry.moduleId}
                className="flex-row items-center gap-3"
                style={entry.hidden ? { opacity: 0.55 } : undefined}
              >
                <View
                  className="h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${color}26` }}
                >
                  <Icon icon={icon} size={18} color={color} />
                </View>
                <Text variant="heading" className="flex-1">
                  {name}
                </Text>

                <View className="flex-row items-center gap-2">
                  <IconButton
                    icon={ChevronUp}
                    label={`Move ${name} up`}
                    disabled={index === 0}
                    onPress={() => setDashboardLayout(moveEntry(layout, index, -1))}
                  />
                  <IconButton
                    icon={ChevronDown}
                    label={`Move ${name} down`}
                    disabled={index === layout.length - 1}
                    onPress={() => setDashboardLayout(moveEntry(layout, index, 1))}
                  />
                  <IconButton
                    icon={entry.hidden ? EyeOff : Eye}
                    label={entry.hidden ? `Show ${name}` : `Hide ${name}`}
                    tint={entry.hidden ? colors.fgFaint : colors.primaryBright}
                    onPress={() =>
                      setDashboardLayout(toggleHidden(layout, entry.moduleId))
                    }
                  />
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
