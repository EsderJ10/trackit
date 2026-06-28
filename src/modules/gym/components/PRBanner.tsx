import { Trophy } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text, colors, glow } from '@/ui';

export interface PRBannerProps {
  /** Null hides the banner; a message shows it with the purple-glow pulse. */
  message: string | null;
}

/**
 * Transient "new PR" celebration shown at the top of the active workout the
 * instant a record-beating set is checked off. Restrained, serious-training tone
 * — a glowing pill, not confetti. The parent clears `message` on a timer.
 */
export function PRBanner({ message }: PRBannerProps) {
  if (message == null) return null;
  return (
    <SafeAreaView
      edges={['top']}
      pointerEvents="none"
      className="absolute inset-x-0 top-0 items-center"
    >
      <View
        className="mt-1 flex-row items-center gap-2 rounded-full border bg-surface-hi px-4 py-2.5"
        style={[
          { borderColor: colors.primaryBright },
          glow(colors.primaryGlow, 0.7),
        ]}
      >
        <Icon icon={Trophy} size={18} color={colors.primaryBright} />
        <Text variant="label" style={{ color: colors.primaryBright }}>
          New PR · {message}
        </Text>
      </View>
    </SafeAreaView>
  );
}
