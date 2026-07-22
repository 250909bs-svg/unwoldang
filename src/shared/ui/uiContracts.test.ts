import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Alert } from './Alert';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Input } from './Input';
import { LiveRegion } from './LiveRegion';
import { Loading } from './Loading';
import { Modal } from './Modal';
import { Select } from './Select';
import { Skeleton } from './Skeleton';

const tokensSource = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const modalSource = readFileSync(new URL('./Modal.tsx', import.meta.url), 'utf8');

describe('shared UI accessibility contracts', () => {
  it('associates Input labels, hints, and errors without discarding legacy classes', () => {
    const html = renderToStaticMarkup(
      createElement(Input, {
        id: 'customer-name',
        label: '이름',
        hint: '리포트에 표시할 이름',
        error: '이름을 입력해 주세요.',
        className: 'legacy-input',
        required: true
      })
    );

    expect(html).toContain('for="customer-name"');
    expect(html).toContain('id="customer-name"');
    expect(html).toContain('aria-describedby="customer-name-hint customer-name-error"');
    expect(html).toContain('aria-errormessage="customer-name-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('ui-field__control legacy-input');
  });

  it('associates Select labels and supporting text', () => {
    const html = renderToStaticMarkup(
      createElement(
        Select,
        {
          id: 'birth-hour',
          label: '태어난 시간',
          hint: '모르면 모름을 선택하세요.'
        },
        createElement('option', { value: '' }, '선택'),
        createElement('option', { value: 'unknown' }, '모름')
      )
    );

    expect(html).toContain('for="birth-hour"');
    expect(html).toContain('aria-describedby="birth-hour-hint"');
    expect(html).toContain('<select');
    expect(html).toContain('ui-field__select');
  });

  it('exposes busy, dialog, status, alert, and decorative semantics', () => {
    const busyButton = renderToStaticMarkup(
      createElement(Button, { loading: true, loadingText: '저장 중', className: 'legacy-button' }, '저장')
    );
    const modal = renderToStaticMarkup(
      createElement(
        Modal,
        { open: true, onClose: () => undefined, title: '확인', description: '계속 진행할까요?' },
        createElement('button', { type: 'button' }, '진행')
      )
    );
    const statuses = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(Alert, { tone: 'error', title: '오류' }, '다시 시도해 주세요.'),
        createElement(Loading, { label: '결과를 만드는 중' }),
        createElement(EmptyState, { title: '결과가 없습니다.' }),
        createElement(ErrorState, { title: '불러오지 못했습니다.' }),
        createElement(LiveRegion, { message: '저장되었습니다.' }),
        createElement(Skeleton, { shape: 'text' })
      )
    );

    expect(busyButton).toContain('aria-busy="true"');
    expect(busyButton).toContain('legacy-button');
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('aria-labelledby=');
    expect(modal).toContain('aria-describedby=');
    expect(statuses).toContain('role="alert"');
    expect(statuses).toContain('role="status"');
    expect(statuses).toContain('aria-live="polite"');
    expect(statuses).toContain('aria-hidden="true"');
  });

  it('implements the modal keyboard, focus, focus-return, and scroll-lock contract', () => {
    expect(modalSource).toContain("event.key === 'Escape'");
    expect(modalSource).toContain("event.key !== 'Tab'");
    expect(modalSource).toContain("document.addEventListener('focusin'");
    expect(modalSource).toContain('lockBodyScroll()');
    expect(modalSource).toContain('unlockBodyScroll()');
    expect(modalSource).toContain('trigger.focus({ preventScroll: true })');
    expect(modalSource).toContain('initialFocusRef?.current');
  });
});

describe('shared UI styling contracts', () => {
  it('defines color, typography, spacing, radius, shadow, z-index, motion, and safe-area tokens', () => {
    expect(tokensSource).toContain('--ui-color-primary:');
    expect(tokensSource).toContain('--ui-font-family-body:');
    expect(tokensSource).toContain('--ui-space-4:');
    expect(tokensSource).toContain('--ui-radius-md:');
    expect(tokensSource).toContain('--ui-shadow-md:');
    expect(tokensSource).toContain('--ui-z-modal:');
    expect(tokensSource).toContain('--ui-motion-duration-normal:');
    expect(tokensSource).toContain('--ui-safe-area-bottom: env(safe-area-inset-bottom');
  });

  it('keeps product overrides in a theme boundary and supplies mobile and motion safeguards', () => {
    expect(tokensSource).toContain('[data-ui-theme]');
    expect(tokensSource).toContain('--ui-theme-primary:');
    expect(stylesSource).toContain(':focus-visible');
    expect(stylesSource).toContain('@media (max-width: 430px)');
    expect(stylesSource).toContain('100dvh');
    expect(stylesSource).toContain('var(--ui-safe-area-bottom)');
    expect(stylesSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stylesSource).toContain('animation-delay: 0ms !important');
    expect(stylesSource).toContain('transition-delay: 0ms !important');
    expect(stylesSource).toContain('var(--ui-theme-surface-strong');
    expect(stylesSource).toContain('.ui-sticky-cta');
  });
});
