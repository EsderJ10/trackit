import { View } from 'react-native';

import { Card, Text, colors } from '@/ui';

import {
  classifyVolume,
  type MuscleLandmarkBands,
  type VolumeZone,
  ZONE_LABEL,
} from '../landmarks';
import { useMuscleLandmarks } from '../queries';

/** Fill color per volume zone, low→high stimulus. */
const ZONE_COLOR: Record<VolumeZone, string> = {
  'below-mv': colors.fgFaint,
  maintenance: colors.warning,
  productive: colors.success,
  maximal: colors.gym,
  overreaching: colors.danger,
};

export interface MuscleVolumeBarsProps {
  /** Per-muscle completed working-set counts for the last 7 days. */
  breakdown: { muscleGroup: string; sets: number }[];
  /** Heading shown above the bars. */
  title?: string;
}

/**
 * This week's working-set volume per muscle, each bar framed against the user's
 * editable MEV/MAV/MRV bands (red/amber/green). The research's #1 UX move —
 * surface volume where you train, not buried in a profile tab. Counts exclude
 * warm-ups (see the setType filters feeding the breakdown).
 */
export function MuscleVolumeBars({
  breakdown,
  title = 'This week by muscle',
}: MuscleVolumeBarsProps) {
  const landmarks = useMuscleLandmarks();
  // Fallback scale for muscles without landmarks (e.g. cardio/custom groups).
  const max = Math.max(1, ...breakdown.map((m) => m.sets));

  return (
    <Card className="gap-3">
      <Text variant="label">{title}</Text>
      {breakdown.length === 0 ? (
        <Text variant="muted">No sets logged in the last 7 days.</Text>
      ) : (
        <>
          <Text variant="caption">
            Weekly sets vs your MEV · MAV · MRV bands
          </Text>
          {breakdown.map((m) => (
            <MuscleVolumeRow
              key={m.muscleGroup}
              muscleGroup={m.muscleGroup}
              sets={m.sets}
              landmark={landmarks.get(m.muscleGroup)}
              fallbackMax={max}
            />
          ))}
          <ZoneLegend />
        </>
      )}
    </Card>
  );
}

function MuscleVolumeRow({
  muscleGroup,
  sets,
  landmark,
  fallbackMax,
}: {
  muscleGroup: string;
  sets: number;
  landmark: MuscleLandmarkBands | undefined;
  fallbackMax: number;
}) {
  if (!landmark) {
    // No landmark (cardio / custom group): plain relative bar, no zone framing.
    return (
      <View className="gap-1">
        <View className="flex-row justify-between">
          <Text variant="muted" className="capitalize">
            {muscleGroup}
          </Text>
          <Text variant="muted">{sets}</Text>
        </View>
        <View className="h-2.5 overflow-hidden rounded-full bg-surface-hi">
          <View
            className="h-2.5 rounded-full"
            style={{
              width: `${(sets / fallbackMax) * 100}%`,
              backgroundColor: colors.gym,
            }}
          />
        </View>
      </View>
    );
  }

  const zone = classifyVolume(sets, landmark);
  // Headroom past MRV so an over-the-ceiling bar still reads as "past the line".
  // Floor at 1 so an all-zero / empty band can't divide-by-zero into NaN widths.
  const scaleMax = Math.max(landmark.mrv, sets, 1) * 1.06;
  const pct = (v: number) => `${(v / scaleMax) * 100}%` as const;
  const ticks = [landmark.mev, landmark.mav, landmark.mrv];

  return (
    <View className="gap-1">
      <View className="flex-row justify-between">
        <Text variant="muted" className="capitalize">
          {muscleGroup}
        </Text>
        <Text variant="muted">
          {sets} · {ZONE_LABEL[zone]}
        </Text>
      </View>
      <View className="relative h-2.5 overflow-hidden rounded-full bg-surface-hi">
        <View
          className="absolute bottom-0 left-0 top-0 rounded-full"
          style={{ width: pct(sets), backgroundColor: ZONE_COLOR[zone] }}
        />
        {ticks.map((t, i) => (
          <View
            key={i}
            className="absolute bottom-0 top-0"
            style={{ left: pct(t), width: 1.5, backgroundColor: colors.bg }}
          />
        ))}
      </View>
    </View>
  );
}

function ZoneLegend() {
  const items: { zone: VolumeZone; label: string }[] = [
    { zone: 'maintenance', label: ZONE_LABEL.maintenance },
    { zone: 'productive', label: ZONE_LABEL.productive },
    { zone: 'maximal', label: ZONE_LABEL.maximal },
    { zone: 'overreaching', label: ZONE_LABEL.overreaching },
  ];
  return (
    <View className="flex-row flex-wrap gap-x-3 gap-y-1 pt-1">
      {items.map((it) => (
        <View key={it.zone} className="flex-row items-center gap-1.5">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: ZONE_COLOR[it.zone] }}
          />
          <Text variant="caption">{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
