import { useEffect, useId, useRef } from 'react';
import type { MouseEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { classNames } from './classNames';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

let bodyLockCount = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';

function lockBodyScroll(): void {
  if (bodyLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
  }
  bodyLockCount += 1;
}

function unlockBodyScroll(): void {
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
  }
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true'
  );
}

function focusFirstElement(container: HTMLElement, preferred?: HTMLElement | null): void {
  const target = preferred ?? getFocusableElements(container)[0] ?? container;
  target.focus({ preventScroll: true });
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement>;
  returnFocusRef?: RefObject<HTMLElement>;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  unstyled?: boolean;
  titleHidden?: boolean;
  portal?: boolean;
  className?: string;
  overlayClassName?: string;
  bodyClassName?: string;
  actionsClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  initialFocusRef,
  returnFocusRef,
  closeLabel = '닫기',
  closeOnBackdrop = true,
  showCloseButton = true,
  unstyled = false,
  titleHidden = false,
  portal = false,
  className,
  overlayClassName,
  bodyClassName,
  actionsClassName
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return undefined;
    }

    const trigger = returnFocusRef?.current ?? (document.activeElement as HTMLElement | null);
    lockBodyScroll();

    const frameId = window.requestAnimationFrame(() => {
      focusFirstElement(dialog, initialFocusRef?.current);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) {
        focusFirstElement(dialog, initialFocusRef?.current);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      unlockBodyScroll();
      if (trigger?.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [initialFocusRef, open, returnFocusRef]);

  if (!open) {
    return null;
  }

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onCloseRef.current();
    }
  };

  const modal = (
    <div
      className={classNames(
        'ui-modal__backdrop',
        unstyled && 'ui-modal__backdrop--unstyled',
        overlayClassName
      )}
      onMouseDown={handleBackdropMouseDown}
      data-ui-modal-backdrop="true"
    >
      <div
        ref={dialogRef}
        className={classNames('ui-modal', unstyled && 'ui-modal--unstyled', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className={classNames('ui-modal__header', titleHidden && 'ui-sr-only')}>
          <h2 id={titleId} className="ui-modal__title">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="ui-modal__description">
              {description}
            </p>
          )}
        </header>
        {showCloseButton && (
          <button type="button" className="ui-modal__close" onClick={() => onCloseRef.current()}>
            <span aria-hidden="true">×</span>
            <span className="ui-sr-only">{closeLabel}</span>
          </button>
        )}
        <div className={classNames('ui-modal__body', bodyClassName)}>{children}</div>
        {actions && <footer className={classNames('ui-modal__actions', actionsClassName)}>{actions}</footer>}
      </div>
    </div>
  );

  return portal && typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
