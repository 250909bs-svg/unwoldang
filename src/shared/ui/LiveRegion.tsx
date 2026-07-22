import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from './classNames';

export interface LiveRegionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children?: ReactNode;
  message?: ReactNode;
  politeness?: 'polite' | 'assertive';
  atomic?: boolean;
  visuallyHidden?: boolean;
}

export function LiveRegion({
  children,
  message,
  politeness = 'polite',
  atomic = true,
  visuallyHidden = true,
  className,
  ...regionProps
}: LiveRegionProps) {
  return (
    <div
      {...regionProps}
      className={classNames(visuallyHidden && 'ui-sr-only', className)}
      role={politeness === 'assertive' ? 'alert' : 'status'}
      aria-live={politeness}
      aria-atomic={atomic}
    >
      {message ?? children}
    </div>
  );
}
