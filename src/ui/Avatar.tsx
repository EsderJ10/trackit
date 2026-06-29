import { View } from 'react-native';

import { cn } from './cn';
import { Text } from './Text';
import { colors } from './theme';

const AVATAR_COLORS = [
  colors.gym,
  colors.finance,
  colors.habits,
  colors.primaryBright,
  colors.primaryGlow,
  colors.warning,
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (first == null) return '?';
  const last = parts[parts.length - 1];
  if (parts.length === 1 || last == null)
    return first.slice(0, 2).toUpperCase();
  return (first[0]! + last[0]!).toUpperCase();
}

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? colors.gym;
}

export interface AvatarProps {
  /** Drives both the initials and the deterministic accent color. */
  name: string;
  /** Diameter in px (default 64). */
  size?: number;
  className?: string;
}

/** Generated initials avatar — color derived deterministically from `name`, no image/storage. */
export function Avatar({ name, size = 64, className }: AvatarProps) {
  const color = colorFor(name);
  return (
    <View
      className={cn('items-center justify-center rounded-full', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}26`,
        borderColor: `${color}59`,
        borderWidth: 1,
      }}
    >
      <Text style={{ color, fontSize: size * 0.38, fontWeight: '700' }}>
        {initials(name)}
      </Text>
    </View>
  );
}
