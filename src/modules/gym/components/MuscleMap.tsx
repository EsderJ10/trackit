import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text, cn, colors } from '@/ui';

import type { Muscle, MuscleView } from '../muscles';
import { muscleLabel } from '../muscles';
import { bodyBack, bodyFront, type BodyPart } from './body-data';
import { MUSCLE_SLUG } from './muscle-slugs';

/** How brightly a body region is painted. */
type Intensity = 'primary' | 'secondary' | 'base';

// Both silhouettes are authored in one 1448-wide canvas (see body-data); each
// view is half as wide as it is tall.
const VIEW_BOX: Readonly<Record<MuscleView, string>> = {
  front: '0 0 724 1448',
  back: '724 0 724 1448',
};
const ASPECT = 724 / 1448; // width / height

const FILL: Readonly<Record<Intensity, { fill: string; opacity: number }>> = {
  primary: { fill: colors.gym, opacity: 1 },
  secondary: { fill: colors.gym, opacity: 0.38 },
  base: { fill: colors.surfaceHi, opacity: 1 },
};

/**
 * Build the slug → intensity map for one view. Secondary is laid down first so a
 * muscle tagged primary always wins when the two overlap on the same slug.
 */
function highlightFor(
  view: MuscleView,
  primary: readonly Muscle[],
  secondary: readonly Muscle[],
): Map<string, Intensity> {
  const map = new Map<string, Intensity>();
  const paint = (muscles: readonly Muscle[], intensity: Intensity) => {
    for (const muscle of muscles) {
      const entry = MUSCLE_SLUG[muscle];
      if (entry.views.includes(view)) map.set(entry.slug, intensity);
    }
  };
  paint(secondary, 'secondary');
  paint(primary, 'primary');
  return map;
}

interface BodyViewProps {
  parts: readonly BodyPart[];
  view: MuscleView;
  highlight: Map<string, Intensity>;
  height: number;
}

/** One silhouette (front or back) with its worked muscles painted. */
function BodyView({ parts, view, highlight, height }: BodyViewProps) {
  return (
    <Svg width={height * ASPECT} height={height} viewBox={VIEW_BOX[view]}>
      {parts.map((part) => {
        // Overlay regions (e.g. side-deltoid) only paint when explicitly lit;
        // otherwise they render nothing so the parent region shows through.
        if (part.overlay && !highlight.has(part.slug)) return null;
        const { fill, opacity } = FILL[highlight.get(part.slug) ?? 'base'];
        const subpaths = [
          ...(part.path.left ?? []),
          ...(part.path.right ?? []),
          ...(part.path.common ?? []),
        ];
        return subpaths.map((d, i) => (
          <Path
            key={`${part.slug}-${i}`}
            d={d}
            fill={fill}
            fillOpacity={opacity}
            stroke={colors.bg}
            strokeWidth={1.5}
          />
        ));
      })}
    </Svg>
  );
}

interface LegendRowProps {
  label: string;
  muscles: readonly Muscle[];
  intensity: Extract<Intensity, 'primary' | 'secondary'>;
}

function LegendRow({ label, muscles, intensity }: LegendRowProps) {
  if (muscles.length === 0) return null;
  return (
    <View className="flex-row items-center gap-2">
      <View
        className="h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: colors.gym,
          opacity: FILL[intensity].opacity,
        }}
      />
      <Text variant="caption" className="uppercase tracking-wide">
        {label}
      </Text>
      <Text variant="label" className="flex-1">
        {muscles.map(muscleLabel).join(', ')}
      </Text>
    </View>
  );
}

export interface MuscleMapProps {
  /** Muscles trained hardest — painted bright. */
  primary: readonly Muscle[];
  /** Supporting muscles — painted dim. Defaults to none. */
  secondary?: readonly Muscle[];
  /** Pixel height of each silhouette. Width follows the body's aspect ratio. */
  height?: number;
  /** Show the primary/secondary muscle list beneath the figures. Default true. */
  showLegend?: boolean;
  className?: string;
}

/**
 * Anatomy diagram: front + back silhouettes with the worked muscles glowing in
 * the gym accent (primary bright, secondary dim). Fully offline — the geometry
 * is bundled (see body-data) and nothing fetches at runtime. Untagged exercises
 * still render the plain silhouette.
 */
export function MuscleMap({
  primary,
  secondary = [],
  height = 200,
  showLegend = true,
  className,
}: MuscleMapProps) {
  const front = useMemo(
    () => highlightFor('front', primary, secondary),
    [primary, secondary],
  );
  const back = useMemo(
    () => highlightFor('back', primary, secondary),
    [primary, secondary],
  );

  return (
    <View className={cn('gap-4', className)}>
      <View className="flex-row items-center justify-center gap-6">
        <BodyView
          parts={bodyFront}
          view="front"
          highlight={front}
          height={height}
        />
        <BodyView
          parts={bodyBack}
          view="back"
          highlight={back}
          height={height}
        />
      </View>
      {showLegend && (primary.length > 0 || secondary.length > 0) && (
        <View className="gap-1.5">
          <LegendRow label="Primary" muscles={primary} intensity="primary" />
          <LegendRow
            label="Support"
            muscles={secondary}
            intensity="secondary"
          />
        </View>
      )}
    </View>
  );
}
