import { View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { cn } from './cn';
import { colors } from './theme';

/** A horizontal reference line drawn behind the series (e.g. a target band). */
export interface ReferenceLine {
  value: number;
  color: string;
}

export interface LineChartProps {
  /** Y-values in series order (x is the index). Needs ≥2 points to render. */
  data: number[];
  /** Stroke color (default primary). */
  color?: string;
  /** Pixel height of the chart (width fills its container). */
  height?: number;
  /**
   * Dashed horizontal markers (e.g. MEV/MAV/MRV bands). Their values join the
   * data in the y-domain so the line and markers share one scale.
   */
  referenceLines?: ReferenceLine[];
  className?: string;
}

/**
 * A minimal, dependency-light trend line. Stretches to fill its container width
 * (`preserveAspectRatio="none"`) with a non-scaling stroke, so it stays crisp at
 * any width. Module-agnostic — give it numbers, it draws the shape. Optional
 * reference lines render behind the series on the same scale.
 */
export function LineChart({
  data,
  color = colors.primaryBright,
  height = 120,
  referenceLines = [],
  className,
}: LineChartProps) {
  if (data.length < 2) return null;

  const pad = 6;
  // Reference values share the domain so markers and the line line up.
  const domain = [...data, ...referenceLines.map((line) => line.value)];
  const min = Math.min(...domain);
  const max = Math.max(...domain);
  const span = max - min || 1;
  const toY = (value: number) =>
    pad + (1 - (value - min) / span) * (height - pad * 2);

  const points = data
    .map((value, index) => `${(index / (data.length - 1)) * 100},${toY(value)}`)
    .join(' ');

  return (
    <View className={cn(className)}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
      >
        {referenceLines.map((line, index) => {
          const y = toY(line.value);
          return (
            <Line
              key={`ref-${index}`}
              x1={0}
              y1={y}
              x2={100}
              y2={y}
              stroke={line.color}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
    </View>
  );
}
