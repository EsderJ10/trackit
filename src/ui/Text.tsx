import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cn } from './cn';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'label'
  | 'muted'
  | 'caption'
  | 'stat';

const VARIANT: Record<TextVariant, string> = {
  display: 'text-3xl font-bold text-fg',
  title: 'text-2xl font-bold text-fg',
  heading: 'text-lg font-semibold text-fg',
  body: 'text-base text-fg',
  label: 'text-sm font-semibold text-fg',
  muted: 'text-sm text-fg-muted',
  caption: 'text-xs text-fg-faint',
  stat: 'text-3xl font-bold tracking-tight text-fg',
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  className?: string;
}

/** Themed text. Pick a `variant` for hierarchy; override with `className`. */
export function Text({ variant = 'body', className, ...rest }: TextProps) {
  return <RNText className={cn(VARIANT[variant], className)} {...rest} />;
}
