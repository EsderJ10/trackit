import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { cn } from './cn';
import { typography } from './theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'label'
  | 'muted'
  | 'caption'
  | 'metric'
  | 'stat';

/**
 * Geometry (size/weight/tracking) comes from the `typography` scale in
 * `theme.ts` — the single source of truth — applied as a `style` so it can't
 * silently diverge from the documented scale the way a parallel Tailwind map
 * did. `muted` reuses the `label` geometry at normal weight; `stat` reuses the
 * tabular-nums `metric` step so dashboard numbers don't jitter.
 */
const VARIANT_STYLE: Record<TextVariant, TextStyle> = {
  display: typography.display,
  title: typography.title,
  heading: typography.heading,
  body: typography.body,
  label: typography.label,
  caption: typography.caption,
  metric: typography.metric,
  muted: { ...typography.label, fontWeight: '400' },
  stat: typography.metric,
};

/** Color is the one thing that stays in className (semantic theme tokens). */
const VARIANT_COLOR: Record<TextVariant, string> = {
  display: 'text-fg',
  title: 'text-fg',
  heading: 'text-fg',
  body: 'text-fg',
  label: 'text-fg',
  caption: 'text-fg-faint',
  metric: 'text-fg',
  muted: 'text-fg-muted',
  stat: 'text-fg',
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  className?: string;
}

/** Themed text. Pick a `variant` for hierarchy; override color with `className`
    and geometry with `style` (the `style` prop wins over the variant). */
export function Text({
  variant = 'body',
  className,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      className={cn(VARIANT_COLOR[variant], className)}
      style={[VARIANT_STYLE[variant], style]}
      {...rest}
    />
  );
}
