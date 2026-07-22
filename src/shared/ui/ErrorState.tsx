import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from './classNames';

export interface ErrorStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function ErrorState({
  title,
  description,
  icon,
  actions,
  className,
  role = 'alert',
  ...stateProps
}: ErrorStateProps) {
  return (
    <div
      {...stateProps}
      className={classNames('ui-state', 'ui-state--error', className)}
      role={role}
      aria-live="assertive"
      aria-atomic="true"
    >
      <span className="ui-state__icon" aria-hidden="true">
        {icon ?? '!'}
      </span>
      <h2 className="ui-state__title">{title}</h2>
      {description && <div className="ui-state__description">{description}</div>}
      {actions && <div className="ui-state__actions">{actions}</div>}
    </div>
  );
}
