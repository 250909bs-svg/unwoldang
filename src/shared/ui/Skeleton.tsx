import type { CSSProperties, HTMLAttributes } from 'react';
import { classNames } from './classNames';

export type SkeletonShape = 'text' | 'rectangle' | 'circle';

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  shape?: SkeletonShape;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
}

export function Skeleton({
  shape = 'text',
  width,
  height,
  className,
  style,
  'aria-label': ariaLabel,
  ...skeletonProps
}: SkeletonProps) {
  return (
    <span
      {...skeletonProps}
      className={classNames('ui-skeleton', `ui-skeleton--${shape}`, className)}
      style={{ width, height, ...style }}
      role={ariaLabel ? 'status' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    />
  );
}
