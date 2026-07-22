import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { classNames } from './classNames';
import { mergeIds } from './mergeIds';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  hideLabel?: boolean;
  fieldClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    hint,
    error,
    hideLabel = false,
    fieldClassName,
    className,
    required,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    'aria-errormessage': ariaErrorMessage,
    ...inputProps
  },
  ref
) {
  const generatedId = useId();
  const controlId = id ?? `ui-input-${generatedId}`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const hasHint = hint !== undefined && hint !== null && hint !== false;
  const hasError = error !== undefined && error !== null && error !== false;

  return (
    <div className={classNames('ui-field', fieldClassName)}>
      <label className={classNames('ui-field__label', hideLabel && 'ui-sr-only')} htmlFor={controlId}>
        {label}
        {required && (
          <span className="ui-field__required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="ui-field__control-wrap">
        <input
          {...inputProps}
          ref={ref}
          id={controlId}
          required={required}
          className={classNames('ui-field__control', className)}
          aria-describedby={mergeIds(ariaDescribedBy, hasHint && hintId, hasError && errorId)}
          aria-errormessage={hasError ? mergeIds(ariaErrorMessage, errorId) : ariaErrorMessage}
          aria-invalid={hasError ? true : ariaInvalid}
        />
      </div>
      {hasHint && (
        <p id={hintId} className="ui-field__hint">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="ui-field__error">
          {error}
        </p>
      )}
    </div>
  );
});
