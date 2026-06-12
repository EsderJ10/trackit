import { Pressable, ScrollView, View } from 'react-native';

import { AccountSettings } from '@/core/auth/AccountSettings';
import { SecuritySettings } from '@/core/auth/SecuritySettings';
import { BackupSettings } from '@/core/backup/BackupSettings';
import { MODULES } from '@/core/module-registry';
import type { WeightUnit } from '@/core/settings/schema';
import { setWeightUnit, useSettings } from '@/core/settings/use-settings';
import { Card, Screen, Text, cn } from '@/ui';

const UNITS: readonly WeightUnit[] = ['kg', 'lb'];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="caption" className="uppercase tracking-wider">
      {children}
    </Text>
  );
}

export default function SettingsRoute() {
  const settings = useSettings();

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-5 p-5"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="display">Settings</Text>

        <View className="gap-2">
          <SectionLabel>Account</SectionLabel>
          <AccountSettings />
        </View>

        <View className="gap-2">
          <SectionLabel>Weight unit</SectionLabel>
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
        </View>

        <View className="gap-2">
          <SectionLabel>Security</SectionLabel>
          <SecuritySettings />
        </View>

        <View className="gap-2">
          <SectionLabel>Data</SectionLabel>
          <BackupSettings />
        </View>

        {MODULES.map((module) => {
          const Panel = module.SettingsPanel;
          if (!Panel) return null;
          return (
            <View key={module.meta.id} className="gap-2">
              <SectionLabel>{module.meta.name}</SectionLabel>
              <Panel />
            </View>
          );
        })}

        <View className="gap-2">
          <SectionLabel>About</SectionLabel>
          <Card>
            <Text variant="muted">TrackIt — a modular tracking app.</Text>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
