import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { cn } from './cn';
import { colors } from './theme';

export interface LineChartProps {
  /** Y-values in series order (x is the index). Needs ≥2 points to render. */
  data: number[];
  /** Stroke color (default primary). */
  color?: string;
  /** Pixel height of the chart (width fills its container). */
  height?: number;
  className?: string;
}

/**
 * A minimal, dependency-light trend line. Stretches to fill its container width
 * (`preserveAspectRatio="none"`) with a non-scaling stroke, so it stays crisp at
 * any width. Module-agnostic — give it numbers, it draws the shape.
 */
export function LineChart({
  data,
  color = colors.primaryBright,
  height = 120,
  className,
}: LineChartProps) {
  if (data.length < 2) return null;

  const pad = 6;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = pad + (1 - (value - min) / span) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View className={cn(className)}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
      >
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
