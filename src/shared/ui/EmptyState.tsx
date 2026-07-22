import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from './classNames';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  actions,
  className,
  ...stateProps
}: EmptyStateProps) {
  return (
    <div {...stateProps} className={classNames('ui-state', 'ui-state--empty', className)}>
      {icon && (
        <span className="ui-state__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <h2 className="ui-state__title">{title}</h2>
      {description && <div className="ui-state__description">{description}</div>}
      {actions && <div className="ui-state__actions">{actions}</div>}
    </div>
  );
}
