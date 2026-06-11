import type { LucideIcon, LucideProps } from 'lucide-react-native';

import { colors } from './theme';

export interface IconProps extends LucideProps {
  icon: LucideIcon;
}

/** Renders a Lucide icon with themed defaults (foreground color, 22px, 2px). */
export function Icon({
  icon: Glyph,
  size = 22,
  color = colors.fg,
  strokeWidth = 2,
  ...rest
}: IconProps) {
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} {...rest} />;
}
