import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Icon, Text, colors } from '@/ui';

export interface ModuleWidgetShellProps {
  title: string;
  icon: LucideIcon;
  /** Module accent (hex) — tints the icon chip. */
  accent: string;
  /** Optional handler — makes the header row tappable. */
  onPress?: () => void;
  children?: ReactNode;
}

/**
 * Visual frame for a module's dashboard widget. `onPress` makes only the header
 * row navigate; `children` (e.g. a CTA) stays independently interactive.
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
