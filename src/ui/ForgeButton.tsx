import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  type PressableProps,
} from 'react-native';

import { cn } from './cn';
import { Text } from './Text';
import { forgeGlow, forgeTokens } from './theme';

export type ForgeButtonSize = 'md' | 'lg';

const SIZE: Record<ForgeButtonSize, string> = {
  md: 'h-12 px-5',
  lg: 'h-14 px-6',
};

export interface ForgeButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  size?: ForgeButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  /** Use the cyber-spark (success / PR) heat instead of magma. */
  tone?: 'magma' | 'spark';
  className?: string;
}

/**
 * The FORGE primary CTA. A molten magma button wrapped in a soft forge-glow
 * that *breathes* at rest and flares hotter on press/hover — "a hot forge".
 *
 * The glow is a translucent disc layered BEHIND the button and animated with
 * the native driver (opacity + scale only), so the pulse never touches the JS
 * thread or animates shadow props (which can't use the native driver). The
 * static `forgeGlow()` shadow underneath gives it depth on iOS / elevation on
 * Android. Standalone by design — `Button` is left untouched (zero regression).
 */
export function ForgeButton({
  label,
  size = 'lg',
  loading = false,
  leftIcon,
  tone = 'magma',
  disabled,
  className,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...rest
}: ForgeButtonProps) {
  const isDisabled = disabled === true || loading;
  const heat = tone === 'spark' ? forgeTokens.sparkGlow : forgeTokens.glow;
  const fill = tone === 'spark' ? forgeTokens.spark : forgeTokens.magma;

  const idle = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;

  // Resting ember breath — slow, subtle, always on (unless disabled).
  useEffect(() => {
    if (isDisabled) {
      idle.stopAnimation();
      idle.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(idle, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isDisabled, idle]);

  const flare = (to: number) =>
    Animated.timing(press, {
      toValue: to,
      duration: to === 1 ? 120 : 320,
      useNativeDriver: true,
    }).start();

  const glowOpacity = Animated.add(
    idle.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.42] }),
    press.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
  );
  const glowScale = Animated.add(
    idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }),
    press.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] }),
  );
  const btnScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });

  return (
    <Animated.View
      style={{ transform: [{ scale: btnScale }], alignSelf: 'stretch' }}
    >
      {/* Pulsing forge-glow disc behind the button. */}
      {!isDisabled ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: 18,
            backgroundColor: heat,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          }}
        />
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPressIn={(e) => {
          flare(1);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          flare(0);
          onPressOut?.(e);
        }}
        onHoverIn={(e) => {
          flare(1);
          onHoverIn?.(e);
        }}
        onHoverOut={(e) => {
          flare(0);
          onHoverOut?.(e);
        }}
        style={[
          { backgroundColor: fill },
          !isDisabled ? forgeGlow(heat, 0.5) : null,
        ]}
        className={cn(
          'flex-row items-center justify-center gap-2 rounded-[18px]',
          SIZE[size],
          isDisabled && 'opacity-50',
          className,
        )}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={forgeTokens.stone} />
        ) : (
          <>
            {leftIcon}
            <Text
              className="text-base font-extrabold"
              style={{ color: forgeTokens.stone, letterSpacing: 0.3 }}
            >
              {label}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
