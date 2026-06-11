import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from './cn';

export interface CardProps extends ViewProps {
  children: ReactNode;
  className?: string;
}

/** Elevated surface card on the dark purple ground. */
export function Card({ children, className, ...rest }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-2xl border border-border-soft bg-surface p-4',
        className,
      )}
      {...rest}
    >
      {children}
    </View>
  );
}
