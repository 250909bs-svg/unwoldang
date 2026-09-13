import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const loadingSource = readSource('../../pages/Loading.tsx');
const loadingStyle = readSource('../../styles/general-signature-loading.css');

describe('general-signature loading experience', () => {
  it('keeps the dedicated experience scoped to general-signature', () => {
    expect(loadingSource).toContain("productDefinition.id === 'general-signature'");
    expect(loadingSource).toContain('general-signature-loading-page');
    expect(loadingSource).toContain('isPastLifeProduct');
  });

  it('shows factual previews and meaningful generation progress', () => {
    expect(loadingSource).toContain('previewReport.pillars');
    expect(loadingSource).toContain('previewReport.fiveElements');
    expect(loadingSource).toContain('LOADING_PHASES');
    expect(loadingSource).toContain('style={{ width: `${progress}%` }}');
    expect(loadingSource).toContain('입력하신 생년월일시와 질문을 바탕으로 결과를 구성합니다.');
  });

  it('provides accessible status updates and reduced-motion support', () => {
    expect(loadingSource).toContain('role="status"');
    expect(loadingSource).toContain('aria-live="polite"');
    expect(loadingStyle).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
