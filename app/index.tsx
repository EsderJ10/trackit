import { View } from 'react-native';

import { Button, Card, Screen, Stat, Text, colors } from '@/ui';

export default function Index() {
  return (
    <Screen className="gap-5 p-5">
      <View className="gap-1">
        <Text variant="display">TrackIt</Text>
        <Text variant="muted">Theme preview</Text>
      </View>

      <Card>
        <Text variant="heading">Gym</Text>
        <Text variant="muted" className="mt-1">
          Push Day · 2 days ago
        </Text>
        <View className="mt-4 flex-row justify-between">
          <Stat label="Sets" value="12" accent={colors.gym} />
          <Stat label="Volume" value="4,200" accent={colors.gym} />
          <Stat label="Streak" value="4d" accent={colors.gym} />
        </View>
      </Card>

      <View className="gap-3">
        <Button label="Start workout" />
        <Button label="Secondary" variant="secondary" />
        <Button label="Ghost" variant="ghost" />
      </View>
    </Screen>
  );
}
