import { Trophy } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Mascot, Text, colors, forgeGlow, forgeTokens, glow } from '@/ui';

export interface PRBannerProps {
  /** Null hides the banner; a message shows it with the purple-glow pulse. */
  message: string | null;
  /**
   * Opt into the FORGE celebration: the golem flares to its SUCCESS state and
   * the pill switches to the cyber-spark accent. Defaults off, so the existing
   * purple-glow banner on the live workout screen is unchanged.
   */
  forge?: boolean;
}

/**
 * Transient "new PR" celebration shown at the top of the active workout the
 * instant a record-beating set is checked off. Restrained, serious-training tone
 * — a glowing pill, not confetti. The parent clears `message` on a timer.
 */
export function PRBanner({ message, forge = false }: PRBannerProps) {
  if (message == null) return null;
  const accent = forge ? forgeTokens.spark : colors.primaryBright;
  return (
    <SafeAreaView
      edges={['top']}
      pointerEvents="none"
      className="absolute inset-x-0 top-0 items-center"
    >
      {forge ? (
        <View className="mt-1 items-center">
          <Mascot state="SUCCESS" size={72} />
        </View>
      ) : null}
      <View
        className="mt-1 flex-row items-center gap-2 rounded-full border bg-surface-hi px-4 py-2.5"
        style={[
          { borderColor: accent },
          forge ? forgeGlow(forgeTokens.sparkGlow, 0.8) : glow(colors.primaryGlow, 0.7),
        ]}
      >
        <Icon icon={Trophy} size={18} color={accent} />
        <Text variant="label" style={{ color: accent }}>
          New PR · {message}
        </Text>
      </View>
    </SafeAreaView>
  );
}
