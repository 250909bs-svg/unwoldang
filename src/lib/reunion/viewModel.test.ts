import { describe, expect, it } from 'vitest';
import type { SajuReportData } from '../saju/report';
import type { CompatibilityAnalysisResult } from '../saju/v2/compatibility';
import {
  REUNION_CONTEXT_VERSION,
  adaptReunionDeterministicEvidence,
  buildReunionViewModel,
  type ReunionContext
} from './index';

const context: ReunionContext = {
  schemaVersion: REUNION_CONTEXT_VERSION,
  breakupDuration: 'oneTo3m',
  contactStatus: 'occasional',
  breakupReason: '답장 속도로 다툼다고 적었어요.',
  desiredOutcome: 'clarity',
  notes: '상대의 마음은 알지 못해요.',
  consentToUsePartnerData: true
};

const compatibility: Pick<CompatibilityAnalysisResult, 'dimensions' | 'overview' | 'uncertainty'> = {
  dimensions: [{
    id: 'dating-emotional-flow',
    label: '감정 교류',
    tendency: 'conditional',
    statement: '감정 표현의 속도를 서로 조율할 필요가 있습니다.',
    evidenceIds: ['compatibility:day-master'],
    confidence: 0.78,
    uncertainty: []
  }],
  overview: {
    tendency: 'conditional',
    statement: '관계는 조율 방식을 현실에서 확인해야 합니다.',
    evidenceIds: ['compatibility:day-master'],
    confidence: 0.72,
    uncertainty: []
  },
  uncertainty: []
};

const sajuReport: Pick<SajuReportData, 'sections' | 'engineMeta'> = {
  sections: [{
    id: 'temporal-evidence-v2',
    title: '시기 근거',
    paragraphs: ['시기 흐름은 사건 확정이 아니라 행동 점검 범위로 사용합니다.']
  }]
};

describe('qualitative reunion view-model adapter', () => {
  it('keeps deterministic engine prose byte-for-byte and user context in a separate collection', () => {
    const model = buildReunionViewModel({ context, sajuReport, compatibility });

    expect(model.deterministicEvidence.map((item) => item.statement)).toContain(
      compatibility.dimensions[0].statement
    );
    expect(model.deterministicEvidence.map((item) => item.statement)).toContain(
      sajuReport.sections[0].paragraphs?.[0]
    );
    expect(model.deterministicEvidence.some((item) => item.statement.includes(context.breakupReason))).toBe(false);
    expect(model.userContext.find((item) => item.id === 'breakupReason')).toMatchObject({
      value: context.breakupReason,
      source: 'user-provided',
      verification: 'unverified'
    });
  });

  it('uses qualitative confidence and exposes no generated probability or score field', () => {
    const model = buildReunionViewModel({ context, sajuReport, compatibility });
    const serialized = JSON.stringify(model);

    expect(model.status).toBe('limited');
    expect(model.findings.map((finding) => finding.confidence)).toEqual(['supported', 'limited']);
    expect(serialized).not.toMatch(/"(?:probability|score|percentage)"\s*:/u);
    expect(model.limitations.join(' ')).toContain('상대의 속마음');
  });

  it('marks unsupported evidence as unknown rather than interpreting numeric engine confidence', () => {
    const unsupported = {
      ...compatibility,
      dimensions: [{
        ...compatibility.dimensions[0],
        tendency: 'insufficient' as const,
        evidenceIds: [],
        confidence: 0,
        uncertainty: ['독립 계산 근거가 없습니다.']
      }],
      overview: {
        ...compatibility.overview,
        tendency: 'insufficient' as const,
        evidenceIds: [],
        confidence: 0
      }
    };
    const model = buildReunionViewModel({ context, compatibility: unsupported });

    expect(model.status).toBe('unknown');
    expect(model.deterministicEvidence.every((item) => item.confidence === 'unknown')).toBe(true);
    expect(model.headline).toContain('판단할 수 없어요');
  });

  it('withholds contact guidance when the user reports a block boundary', () => {
    const model = buildReunionViewModel({
      context: { ...context, contactStatus: 'blocked' },
      compatibility
    });

    expect(model.contactBoundary.status).toBe('withheld');
    expect(model.contactBoundary.message).toContain('우회 연락을 제안하지 않고');
  });

  it('adapts the same input deterministically', () => {
    const input = { context, sajuReport, compatibility };
    expect(buildReunionViewModel(input)).toEqual(buildReunionViewModel(input));
    expect(adaptReunionDeterministicEvidence(input)).toEqual(adaptReunionDeterministicEvidence(input));
  });
});
