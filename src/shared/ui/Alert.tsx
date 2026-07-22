import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from './classNames';

export type AlertTone = 'info' | 'success' | 'warning' | 'error';

const DEFAULT_ICONS: Record<AlertTone, string> = {
  info: 'ⓘ',
  success: '✓',
  warning: '!',
  error: '!'
};

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: AlertTone;
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function Alert({
  tone = 'info',
  title,
  icon,
  actions,
  children,
  className,
  role,
  'aria-live': ariaLive,
  ...alertProps
}: AlertProps) {
  const urgent = tone === 'error' || tone === 'warning';

  return (
    <div
      {...alertProps}
      className={classNames('ui-alert', `ui-alert--${tone}`, className)}
      role={role ?? (urgent ? 'alert' : 'status')}
      aria-live={ariaLive ?? (urgent ? 'assertive' : 'polite')}
      aria-atomic="true"
    >
      <span className="ui-alert__icon" aria-hidden="true">
        {icon ?? DEFAULT_ICONS[tone]}
      </span>
      <div className="ui-alert__content">
        {title && <h2 className="ui-alert__title">{title}</h2>}
        {children && <div className="ui-alert__body">{children}</div>}
        {actions && <div className="ui-alert__actions">{actions}</div>}
      </div>
    </div>
  );
}
