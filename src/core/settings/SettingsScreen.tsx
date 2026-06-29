import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { AccountSettings } from '@/core/auth/AccountSettings';
import { SecuritySettings } from '@/core/auth/SecuritySettings';
import { BackupSettings } from '@/core/backup/BackupSettings';
import { MODULES } from '@/core/module-registry';
import type { WeightUnit } from '@/core/settings/schema';
import { setWeightUnit, useSettings } from '@/core/settings/use-settings';
import { Card, Icon, Screen, Section, Text, cn, colors } from '@/ui';

const UNITS: readonly WeightUnit[] = ['kg', 'lb'];

/** Settings surface (modal); module-agnostic — `SettingsPanel`s slot in from the registry. */
export function SettingsScreen() {
  const router = useRouter();
  const settings = useSettings();

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-5 p-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <Text variant="display">Settings</Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70"
          >
            <Icon icon={X} size={20} color={colors.fgMuted} />
          </Pressable>
        </View>

        <Section title="Account">
          <AccountSettings />
        </Section>

        <Section title="Weight unit">
          <Card className="flex-row gap-2 p-2">
            {UNITS.map((unit) => {
              const active = settings.weightUnit === unit;
              return (
                <Pressable
                  key={unit}
                  onPress={() => setWeightUnit(unit)}
                  className={cn(
                    'flex-1 items-center rounded-xl py-3',
                    active ? 'bg-primary' : 'bg-surface-hi',
                  )}
                >
                  <Text
                    className={cn(
                      'font-semibold',
                      active ? 'text-fg' : 'text-fg-muted',
                    )}
                  >
                    {unit.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        </Section>

        <Section title="Security">
          <SecuritySettings />
        </Section>

        <Section title="Data">
          <BackupSettings />
        </Section>

        {MODULES.map((module) => {
          const Panel = module.SettingsPanel;
          if (!Panel) return null;
          return (
            <Section key={module.meta.id} title={module.meta.name}>
              <Panel />
            </Section>
          );
        })}

        <Section title="About">
          <Card>
            <Text variant="muted">TrackIt — a modular tracking app.</Text>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
