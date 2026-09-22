import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getRouteShellPolicy, getShellContainerClassName } from '../../app/shell';

const readSource = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const landingSource = readSource('../../pages/GeneralSajuLanding.tsx');
const intakeSource = readSource('./GeneralSignatureIntake.tsx');
const formSource = readSource('../../pages/Form.tsx');
const appSource = readSource('../../App.tsx');

describe('general-signature video entry and immersive intake contract', () => {
  it('uses the approved MP4 immediately on the detail route', () => {
    expect(landingSource).toContain("const VIDEO_SOURCE = '/general-saju-entry.mp4'");
    expect(landingSource).toContain('autoPlay');
    expect(landingSource).toContain('muted={isMuted}');
    expect(landingSource).toContain('loop');
    expect(landingSource).toContain('playsInline');
    expect(landingSource).toContain('<strong>종합사주 보러가기</strong>');
    expect(landingSource).not.toContain('출생정보와 질문 두 가지로 나만의 인생 흐름을 확인해 보세요.');
    expect(landingSource).not.toContain('전체 리포트 · 990원');
    expect(landingSource).toContain("const FORM_PATH = '/form/general-signature'");
    expect(landingSource).toContain('<MobileTopBar title="운월당" />');
    expect(landingSource).toContain('aria-label="영상 소리 재생"');
    expect(landingSource).toContain('클릭하면 소리가 나요');
    expect(landingSource).not.toContain('소리 켜기');
  });

  it('routes only general-signature to the dedicated intake', () => {
    expect(formSource).toContain("id === 'general-signature' ? <GeneralSignatureIntake /> : <LegacyForm />");
    // The shell decision moved out of App.tsx into the declarative route table.
    expect(appSource).toContain('getRouteShellPolicy');
    expect(getShellContainerClassName(getRouteShellPolicy('/form/general-signature'))).toBe(
      'app-container general-saju-intake-app-container'
    );
  });

  it('keeps the intake background video muted and looping', () => {
    expect(intakeSource).toContain("const VIDEO_SOURCE = '/general-saju-entry.mp4'");
    expect(intakeSource).toMatch(/autoPlay[\s\S]*muted[\s\S]*loop[\s\S]*playsInline/u);
  });

  it('uses the neutral 2000-01-01 birth-date example without changing input parsing', () => {
    expect(intakeSource).toContain('placeholder="2000.01.01"');
    expect(intakeSource).not.toContain('placeholder="1992.09.09"');
  });

  it('keeps all three relationship states and four canonical durations reachable', () => {
    for (const status of ['single', 'situationship', 'dating']) {
      expect(intakeSource).toContain(`value: '${status}'`);
    }
    for (const duration of ['under1', 'under3', 'under5', 'under10']) {
      expect(intakeSource).toContain(`value: '${duration}'`);
    }
  });

  it('preserves server-side release preflight before checkout', () => {
    const preflightIndex = intakeSource.indexOf('await requestGeneralSignatureReleasePreflight');
    const checkoutIndex = intakeSource.indexOf("navigate('/checkout'");
    expect(preflightIndex).toBeGreaterThan(-1);
    expect(checkoutIndex).toBeGreaterThan(preflightIndex);
    expect(intakeSource).toContain("preflight.status === 'manual-review-required'");
    expect(intakeSource).toContain("preflight.status === 'blocked'");
    expect(intakeSource).toContain('canContinueManualReviewInLocalPreview');
    expect(intakeSource).toContain('isDevelopment: import.meta.env.DEV');
  });
});
