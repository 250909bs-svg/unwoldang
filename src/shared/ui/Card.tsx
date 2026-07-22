import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { classNames } from './classNames';

export type CardVariant = 'elevated' | 'subtle' | 'outlined' | 'flat';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'elevated', padding = 'md', className, ...cardProps },
  ref
) {
  return (
    <div
      {...cardProps}
      ref={ref}
      className={classNames(
        'ui-card',
        `ui-card--${variant}`,
        `ui-card--padding-${padding}`,
        className
      )}
    />
  );
});
