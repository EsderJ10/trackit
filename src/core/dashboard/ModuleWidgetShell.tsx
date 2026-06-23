import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Icon, Text, colors } from '@/ui';

export interface ModuleWidgetShellProps {
  title: string;
  icon: LucideIcon;
  /** Module accent (hex) — tints the icon chip. */
  accent: string;
  /** Optional handler — makes the header row tappable (e.g. open the module). */
  onPress?: () => void;
  children?: ReactNode;
}

/**
 * Consistent visual frame for a module's dashboard widget: accented icon chip,
 * title, a "tap to open" chevron, and the module's own content below. Pass
 * `onPress` to make the header row navigate; the module's own content (e.g. a
 * primary CTA button) stays independently interactive.
 */
export function ModuleWidgetShell({
  title,
  icon,
  accent,
  onPress,
  children,
}: ModuleWidgetShellProps) {
  const header = (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <View
          className="h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}26` }}
        >
          <Icon icon={icon} size={18} color={accent} />
        </View>
        <Text variant="heading">{title}</Text>
      </View>
      <Icon icon={ChevronRight} size={18} color={colors.fgFaint} />
    </View>
  );

  return (
    <Card>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Open ${title}`}
          className="active:opacity-70"
        >
          {header}
        </Pressable>
      ) : (
        header
      )}
      {children ? <View className="mt-4">{children}</View> : null}
    </Card>
  );
}
