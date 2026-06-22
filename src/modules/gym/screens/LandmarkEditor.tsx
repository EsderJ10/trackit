import { Stack } from 'expo-router';
import { Minus, Plus, RotateCcw, type LucideIcon } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { Button, Card, Icon, Screen, Text, colors } from '@/ui';

import {
  DEFAULT_MUSCLE_LANDMARKS,
  type LandmarkKey,
  type MuscleLandmarkBands,
  setBand,
} from '../landmarks';
import {
  resetMuscleLandmarks,
  setMuscleLandmark,
  useMuscleLandmarks,
} from '../queries';

const BANDS: readonly LandmarkKey[] = ['mv', 'mev', 'mav', 'mrv'];

const BAND_LABEL: Record<LandmarkKey, string> = {
  mv: 'MV · maintain',
  mev: 'MEV · grow',
  mav: 'MAV · optimal',
  mrv: 'MRV · ceiling',
};

function StepButton({
  icon,
  onPress,
  disabled,
}: {
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      className="h-9 w-9 items-center justify-center rounded-xl bg-surface-hi"
      style={disabled ? { opacity: 0.4 } : undefined}
    >
      <Icon icon={icon} size={18} color={colors.fg} />
    </Pressable>
  );
}

function BandStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="muted">{label}</Text>
      <View className="flex-row items-center gap-3">
        <StepButton
          icon={Minus}
          onPress={() => onChange(value - 1)}
          disabled={value <= 0}
        />
        <Text variant="label" className="w-8 text-center">
          {value}
        </Text>
        <StepButton icon={Plus} onPress={() => onChange(value + 1)} />
      </View>
    </View>
  );
}

function LandmarkRow({
  muscle,
  bands,
}: {
  muscle: string;
  bands: MuscleLandmarkBands;
}) {
  function edit(key: LandmarkKey, value: number) {
    setMuscleLandmark(muscle, setBand(bands, key, value));
  }
  return (
    <Card className="gap-3">
      <Text variant="heading" className="capitalize">
        {muscle}
      </Text>
      {BANDS.map((key) => (
        <BandStepper
          key={key}
          label={BAND_LABEL[key]}
          value={bands[key]}
          onChange={(next) => edit(key, next)}
        />
      ))}
    </Card>
  );
}

export function LandmarkEditor() {
  const landmarks = useMuscleLandmarks();

  // Show the canonical muscle order first, then any custom groups, alphabetical.
  const defaultOrder = Object.keys(DEFAULT_MUSCLE_LANDMARKS);
  const extras = [...landmarks.keys()]
    .filter((m) => !defaultOrder.includes(m))
    .sort();
  const muscles = [...defaultOrder, ...extras].filter((m) => landmarks.has(m));

  function confirmReset() {
    Alert.alert(
      'Reset volume landmarks?',
      'This restores every muscle to the default MEV / MAV / MRV ranges.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => resetMuscleLandmarks(),
        },
      ],
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Volume landmarks' }} />
      <ScrollView
        contentContainerClassName="gap-3 p-5"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="muted">
          Weekly working sets per muscle. These are research-backed starting
          points — tune them to your own recovery. Bands always stay ordered
          MV ≤ MEV ≤ MAV ≤ MRV.
        </Text>

        {muscles.map((muscle) => {
          const bands = landmarks.get(muscle);
          if (!bands) return null;
          return <LandmarkRow key={muscle} muscle={muscle} bands={bands} />;
        })}

        <Button
          variant="secondary"
          label="Reset to defaults"
          leftIcon={<Icon icon={RotateCcw} size={18} color={colors.fg} />}
          onPress={confirmReset}
          className="mt-2"
        />
      </ScrollView>
    </Screen>
  );
}
