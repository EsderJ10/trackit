import { Flame, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { ForgeButton } from './ForgeButton';
import { Icon } from './Icon';
import { Mascot, MASCOT_STATES, type MascotState } from './Mascot';
import { Screen } from './Screen';
import { Text } from './Text';
import { colors, forgeTokens, typography, type TypographyStep } from './theme';

/** Type steps in display order. */
const TYPE_ORDER: readonly TypographyStep[] = [
  'display',
  'title',
  'heading',
  'body',
  'label',
  'caption',
  'metric',
];

/** Swatches to QA — the FORGE branding layer plus the core anchors. */
const SWATCHES: readonly { name: string; value: string }[] = [
  { name: 'forge / magma', value: colors.forge },
  { name: 'forgeBright', value: colors.forgeBright },
  { name: 'forgeGlow', value: colors.forgeGlow },
  { name: 'forgeEmber', value: colors.forgeEmber },
  { name: 'forgeSpark', value: colors.forgeSpark },
  { name: 'forgeSparkGlow', value: colors.forgeSparkGlow },
  { name: 'forgeStone', value: colors.forgeStone },
  { name: 'forgeIron', value: colors.forgeIron },
  { name: 'forgeIronHi', value: colors.forgeIronHi },
  { name: 'forgeLocked', value: colors.forgeLocked },
  { name: 'core bg', value: colors.bg },
  { name: 'core primary', value: colors.primary },
];

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      variant="caption"
      className="mb-3 mt-8 uppercase"
      style={{ color: colors.forgeEmber, letterSpacing: 1.5 }}
    >
      {children}
    </Text>
  );
}

/**
 * FORGE design-system styleguide / preview screen. Renders the full token set,
 * typography scale, button variants and all five mascot states side-by-side for
 * QA. Reachable at `/styleguide` — it runs in parallel and touches no existing
 * screen, so the design system can be reviewed without affecting the app.
 */
export function StyleguideScreen() {
  const [demoState, setDemoState] = useState<MascotState>('IDLE');

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3">
          <Mascot state="WORKING" size={56} />
          <View>
            <Text style={typography.title}>FORGE</Text>
            <Text variant="muted">Design System · Styleguide</Text>
          </View>
        </View>

        {/* ── Typography ─────────────────────────────────────────────── */}
        <SectionTitle>Typography</SectionTitle>
        <Card className="gap-3">
          {TYPE_ORDER.map((step) => (
            <View key={step} className="border-b border-border-soft pb-3">
              <Text variant="caption" className="mb-1">
                {step}
              </Text>
              <Text style={typography[step]}>
                {step === 'metric' ? '102.5 kg × 5' : 'Forge your strength'}
              </Text>
            </View>
          ))}
        </Card>

        {/* ── Color tokens ───────────────────────────────────────────── */}
        <SectionTitle>Color Tokens</SectionTitle>
        <View className="flex-row flex-wrap gap-3">
          {SWATCHES.map((s) => (
            <View key={s.name} style={{ width: 96 }}>
              <View
                style={{
                  height: 56,
                  borderRadius: 12,
                  backgroundColor: s.value,
                  borderWidth: 1,
                  borderColor: colors.borderSoft,
                }}
              />
              <Text variant="caption" className="mt-1">
                {s.name}
              </Text>
              <Text variant="caption" style={{ color: colors.fgFaint }}>
                {s.value}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Buttons ────────────────────────────────────────────────── */}
        <SectionTitle>Buttons</SectionTitle>
        <Card className="gap-3">
          <Text variant="caption">Legacy Button (unchanged)</Text>
          <Button label="Primary" variant="primary" />
          <Button label="Secondary" variant="secondary" />
          <Button label="Ghost" variant="ghost" />
          <Button label="Danger" variant="danger" />

          <Text variant="caption" className="mt-4">
            ForgeButton — pulsing forge-glow (press / hover to flare)
          </Text>
          <ForgeButton label="START WORKOUT" leftIcon={<Icon icon={Flame} size={18} color={colors.forgeStone} />} />
          <ForgeButton label="Spark tone (PR)" tone="spark" leftIcon={<Icon icon={Trophy} size={18} color={colors.forgeStone} />} />
          <ForgeButton label="Medium" size="md" />
          <ForgeButton label="Loading" loading />
          <ForgeButton label="Disabled" disabled />
        </Card>

        {/* ── Mascot states ──────────────────────────────────────────── */}
        <SectionTitle>Mascot · 5 States</SectionTitle>
        <Card>
          <View className="flex-row flex-wrap justify-between">
            {MASCOT_STATES.map((s) => (
              <View key={s} className="mb-4 items-center" style={{ width: '33%' }}>
                <Mascot state={s} size={84} />
                <Text variant="caption" className="mt-1">
                  {s}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* ── Live transition QA ─────────────────────────────────────── */}
        <SectionTitle>Transition QA (no layout shift)</SectionTitle>
        <Card className="items-center gap-4">
          <Mascot state={demoState} size={140} />
          <View className="flex-row flex-wrap justify-center gap-2">
            {MASCOT_STATES.map((s) => (
              <Pressable
                key={s}
                onPress={() => setDemoState(s)}
                className="rounded-full border px-3 py-1.5"
                style={{
                  borderColor: demoState === s ? colors.forge : colors.border,
                  backgroundColor:
                    demoState === s ? colors.forgeIron : 'transparent',
                }}
              >
                <Text
                  variant="caption"
                  style={{ color: demoState === s ? colors.forgeEmber : colors.fgMuted }}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* ── Integrated components ──────────────────────────────────── */}
        <SectionTitle>EmptyState + Golem</SectionTitle>
        <Card style={{ height: 320 }}>
          <EmptyState
            mascot="IDLE"
            title="No program yet"
            description="Choose a program to forge your golem, rep by rep."
            action={<ForgeButton label="Choose a program" size="md" />}
          />
        </Card>

        <SectionTitle>PR Banner · forge variant</SectionTitle>
        <View
          style={{
            height: 180,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: colors.surface,
          }}
        >
          {/* Inline (non-absolute) preview of the celebration. */}
          <View className="items-center pt-4">
            <Mascot state="SUCCESS" size={96} />
            <View
              className="mt-1 flex-row items-center gap-2 rounded-full border bg-surface-hi px-4 py-2.5"
              style={{ borderColor: forgeTokens.spark }}
            >
              <Icon icon={Trophy} size={18} color={forgeTokens.spark} />
              <Text variant="label" style={{ color: forgeTokens.spark }}>
                New PR · Bench 102.5 kg × 5
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
