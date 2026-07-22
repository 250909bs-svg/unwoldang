import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from './classNames';

export type LoadingSize = 'sm' | 'md' | 'lg';

export interface LoadingProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  size?: LoadingSize;
  inline?: boolean;
  visuallyHiddenLabel?: boolean;
}

export function Loading({
  label = '불러오는 중',
  size = 'md',
  inline = false,
  visuallyHiddenLabel = false,
  className,
  ...loadingProps
}: LoadingProps) {
  return (
    <div
      {...loadingProps}
      className={classNames('ui-loading', inline && 'ui-loading--inline', className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        className={classNames(
          'ui-spinner',
          size === 'sm' && 'ui-spinner--sm',
          size === 'lg' && 'ui-spinner--lg'
        )}
        aria-hidden="true"
      />
      <span className={classNames(visuallyHiddenLabel && 'ui-sr-only')}>{label}</span>
    </div>
  );
}
