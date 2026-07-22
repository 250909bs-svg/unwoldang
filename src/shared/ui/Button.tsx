import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from './classNames';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  loadingText?: ReactNode;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    block = false,
    loading = false,
    loadingText,
    startIcon,
    endIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...buttonProps
  },
  ref
) {
  return (
    <button
      {...buttonProps}
      ref={ref}
      type={type}
      className={classNames(
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        block && 'ui-button--block',
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <span className={classNames('ui-spinner', size === 'sm' && 'ui-spinner--sm')} aria-hidden="true" />
      ) : (
        startIcon && (
          <span className="ui-button__icon" aria-hidden="true">
            {startIcon}
          </span>
        )
      )}
      <span className="ui-button__content">{loading && loadingText !== undefined ? loadingText : children}</span>
      {!loading && endIcon && (
        <span className="ui-button__icon" aria-hidden="true">
          {endIcon}
        </span>
      )}
    </button>
  );
});
