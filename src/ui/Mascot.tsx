import { Lock } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, type ViewStyle, View } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';

import { Icon } from './Icon';
import { forgeTokens } from './theme';

/**
 * The FORGE mascot — a stone golem, "forged rep by rep". One prop-driven
 * component covering every brand moment: empty states, the active logger, PR
 * celebrations, missed-target coaching, and locked/premium surfaces.
 *
 * Implementation notes (deliberate):
 *  - The golem is a lightweight static SVG (no Lottie, no bitmaps). Per-state
 *    look is pure color + overlay, computed in JS — so a state swap is a plain
 *    re-render with NO layout shift (the container is fixed-size). The breathing
 *    + glow motion is continuous across states; the color itself swaps instantly
 *    rather than crossfading (a true SVG-fill tween would need the JS thread or
 *    Reanimated worklets, both avoided here for robustness) — a deliberate
 *    trade-off favouring native-driver reliability over a fade.
 *  - Motion (breathing + a soft pulsing forge-glow) uses the React Native
 *    `Animated` API with the NATIVE driver (transform + opacity only). We avoid
 *    Reanimated worklets and animating SVG props directly, both of which are
 *    unproven in this repo — keeping the mascot robust across platforms.
 */
export type MascotState = 'IDLE' | 'WORKING' | 'SUCCESS' | 'WARNING' | 'LOCKED';

/** All states, in display order — handy for the styleguide / QA. */
export const MASCOT_STATES: readonly MascotState[] = [
  'IDLE',
  'WORKING',
  'SUCCESS',
  'WARNING',
  'LOCKED',
] as const;

interface StateLook {
  /** Stone body fill. */
  body: string;
  /** Iron outline / plating. */
  edge: string;
  /** Core, eyes & cracks accent (the "heat"). */
  accent: string;
  /** Peak opacity of the pulsing glow halo (0 disables it). */
  glowPeak: number;
  /** Breathing cycle in ms (lower = more energetic). */
  breathMs: number;
  /** Glow pulse cycle in ms. */
  pulseMs: number;
  /** Whether the golem animates at all (LOCKED is frozen). */
  animate: boolean;
}

// Per-state look is sourced from `forgeTokens` (the active theme), NOT the raw
// palette — so flipping `activeTheme` in theme.ts genuinely re-skins the golem.
const LOOK: Record<MascotState, StateLook> = {
  IDLE: {
    body: forgeTokens.iron,
    edge: forgeTokens.ironHi,
    accent: forgeTokens.ember,
    glowPeak: 0.55,
    breathMs: 2600,
    pulseMs: 2600,
    animate: true,
  },
  WORKING: {
    body: forgeTokens.iron,
    edge: forgeTokens.ironHi,
    accent: forgeTokens.magma,
    glowPeak: 0.85,
    breathMs: 1400,
    pulseMs: 1100,
    animate: true,
  },
  SUCCESS: {
    body: forgeTokens.ironHi,
    edge: forgeTokens.spark,
    accent: forgeTokens.spark,
    glowPeak: 1,
    breathMs: 900,
    pulseMs: 700,
    animate: true,
  },
  WARNING: {
    body: forgeTokens.iron,
    edge: forgeTokens.ironHi,
    accent: forgeTokens.warning,
    glowPeak: 0.45,
    breathMs: 2000,
    pulseMs: 1500,
    animate: true,
  },
  LOCKED: {
    body: forgeTokens.stone,
    edge: forgeTokens.locked,
    accent: forgeTokens.locked,
    glowPeak: 0,
    breathMs: 0,
    pulseMs: 0,
    animate: false,
  },
};

export interface MascotProps {
  /** Which golem state to render. Defaults to IDLE. */
  state?: MascotState;
  /** Square footprint in px (height is 1.2×). Defaults to 96. */
  size?: number;
  style?: ViewStyle;
  /** Disable motion (accessibility / reduced-motion / perf-sensitive lists). */
  static?: boolean;
}

/** Stone-golem mascot for the FORGE design system. */
export function Mascot({
  state = 'IDLE',
  size = 96,
  style,
  static: noMotion = false,
}: MascotProps) {
  const look = LOOK[state];
  const animate = look.animate && !noMotion;

  // 0→1 loops; interpolated into transforms/opacity on the native thread.
  const breath = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      breath.stopAnimation();
      pulse.stopAnimation();
      breath.setValue(0);
      pulse.setValue(0.5);
      return;
    }

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: look.breathMs / 2,
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: look.breathMs / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: look.pulseMs / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: look.pulseMs / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    breathLoop.start();
    pulseLoop.start();
    return () => {
      breathLoop.stop();
      pulseLoop.stop();
    };
  }, [animate, look.breathMs, look.pulseMs, breath, pulse]);

  const breathScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });
  const breathShift = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -size * 0.02],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [look.glowPeak * 0.4, look.glowPeak],
  });
  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.12],
  });

  const w = size;
  const h = size * 1.2;
  const haloSize = size * 0.78;

  return (
    <View
      style={[
        { width: w, height: h, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      {/* Forge-glow halo — layered translucent discs (radial fake), pulsing.
          Behind the golem; the soft bleed reads as heat from the chest core. */}
      {look.glowPeak > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: look.accent,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: haloSize * 0.22,
              top: haloSize * 0.22,
              width: haloSize * 0.56,
              height: haloSize * 0.56,
              borderRadius: haloSize * 0.28,
              backgroundColor: look.accent,
            }}
          />
        </Animated.View>
      ) : null}

      <Animated.View
        style={{ transform: [{ translateY: breathShift }, { scale: breathScale }] }}
      >
        <Svg width={w} height={h} viewBox="0 0 100 120">
          <G>
            {/* Arms */}
            <Rect x={8} y={44} width={15} height={36} rx={7} fill={look.body} stroke={look.edge} strokeWidth={2} />
            <Rect x={77} y={44} width={15} height={36} rx={7} fill={look.body} stroke={look.edge} strokeWidth={2} />
            <Circle cx={15.5} cy={82} r={9} fill={look.body} stroke={look.edge} strokeWidth={2} />
            <Circle cx={84.5} cy={82} r={9} fill={look.body} stroke={look.edge} strokeWidth={2} />

            {/* Legs */}
            <Rect x={31} y={88} width={16} height={28} rx={6} fill={look.body} stroke={look.edge} strokeWidth={2} />
            <Rect x={53} y={88} width={16} height={28} rx={6} fill={look.body} stroke={look.edge} strokeWidth={2} />

            {/* Torso */}
            <Rect x={26} y={40} width={48} height={48} rx={12} fill={look.body} stroke={look.edge} strokeWidth={2.5} />

            {/* Head */}
            <Rect x={34} y={6} width={32} height={28} rx={9} fill={look.body} stroke={look.edge} strokeWidth={2.5} />
            {/* Eyes — the heat reads here too */}
            <Circle cx={43} cy={20} r={3.4} fill={look.accent} />
            <Circle cx={57} cy={20} r={3.4} fill={look.accent} />

            {/* Cracks radiating from the core */}
            <Line x1={50} y1={64} x2={40} y2={50} stroke={look.accent} strokeWidth={2} strokeLinecap="round" opacity={0.65} />
            <Line x1={50} y1={64} x2={62} y2={52} stroke={look.accent} strokeWidth={2} strokeLinecap="round" opacity={0.65} />
            <Line x1={50} y1={64} x2={48} y2={80} stroke={look.accent} strokeWidth={2} strokeLinecap="round" opacity={0.65} />

            {/* Chest core — the forge */}
            <Circle cx={50} cy={64} r={11} fill={look.body} stroke={look.accent} strokeWidth={2.5} />
            <Circle cx={50} cy={64} r={6} fill={look.accent} />
          </G>
        </Svg>
      </Animated.View>

      {/* LOCKED overlay — a padlock over the dimmed, frozen golem. */}
      {state === 'LOCKED' ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon icon={Lock} size={size * 0.34} color={forgeTokens.fgMuted} />
        </View>
      ) : null}
    </View>
  );
}
