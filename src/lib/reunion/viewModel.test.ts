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

/**
 * `reportBuilder.ts:3057-3084` 이 직렬화한 `compatibility-evidence-v2` 섹션의 `cards`/`details` 는
 * 여기까지 읽히지 않으면 CH02·CH05 가 쓸 근거가 없다. 이 어댑터가 유일한 경로다.
 */
const compatibilitySection: SajuReportData['sections'][number] = {
  id: 'compatibility-evidence-v2',
  title: '두 사람 정밀 궁합 근거',
  paragraphs: ['두 사람의 구조는 조율 방식을 현실에서 확인해야 합니다.'],
  cards: [
    { title: '초기 끌림과 반응성', body: '처음 반응 속도는 서로 맞는 편입니다.', tone: 'good', badge: 'supportive · 근거 강함' },
    { title: '표현과 의사소통', body: '말을 꺼내는 방식이 서로 다르게 잡힙니다.', tone: 'warn', badge: 'tension · 근거 보통' },
    { title: '관계 지속과 회복', body: '', tone: 'default', badge: 'insufficient · 판정 유보' }
  ],
  details: [
    {
      summary: 'spouse-palace · mixed',
      content:
        '배우자궁에서 접점과 마찰이 함께 잡힙니다.\n\n근거 ID: compatibility:spouse-palace\n\n유보: 상대의 태어난 시간이 확정되지 않았습니다.',
      open: true
    }
  ]
};

describe('compatibility cards and details adapter', () => {
  const report: Pick<SajuReportData, 'sections' | 'engineMeta'> = { sections: [compatibilitySection] };

  it('reads paragraphs, cards and details from the same section', () => {
    const evidence = adaptReunionDeterministicEvidence({ sajuReport: report });
    const ids = evidence.map((item) => item.id);

    expect(ids).toContain('report:compatibility-evidence-v2:0');
    expect(ids).toContain('report:compatibility-evidence-v2:card:0');
    expect(ids).toContain('report:compatibility-evidence-v2:detail:0');
  });

  it('keeps paragraphs first so existing consumers still read index 0', () => {
    const evidence = adaptReunionDeterministicEvidence({ sajuReport: report });
    expect(evidence[0].sourcePath).toBe('sections.0.paragraphs.0');
  });

  it('labels each card with the axis name and traces its source path', () => {
    const card = adaptReunionDeterministicEvidence({ sajuReport: report }).find(
      (item) => item.id === 'report:compatibility-evidence-v2:card:0'
    );
    expect(card).toMatchObject({
      source: 'compatibility',
      label: '초기 끌림과 반응성',
      statement: '처음 반응 속도는 서로 맞는 편입니다.',
      tendency: 'supportive',
      sourcePath: 'sections.0.cards.0'
    });
  });

  it('splits the badge into tendency and evidence confidence instead of showing it raw', () => {
    const evidence = adaptReunionDeterministicEvidence({ sajuReport: report });
    const tension = evidence.find((item) => item.label === '표현과 의사소통');
    expect(tension?.tendency).toBe('tension');
    expect(JSON.stringify(evidence)).not.toContain('근거 강함 ·');
  });

  it('reads the Korean badge the customer report actually carries, not just the raw identifier', () => {
    /**
     * 위 픽스처의 `supportive · 근거 강함` 은 **엔진 내부 형태**다.
     * 고객에게 도달하기 전 `finalizeCustomerReport` → `customerTendency` 가 영문 식별자를
     * 한국어로 바꾸고 `· 근거 강함` 꼬리를 떼어 내므로, 실제 화면이 받는 값은 한 덩어리다.
     * 영문 전용 파서를 두면 실제 리포트에서 네 축이 전부 '근거부족'으로 착지한다.
     */
    const delivered: SajuReportData['sections'][number] = {
      ...compatibilitySection,
      cards: [
        { title: '초기 끌림과 반응성', body: '처음 반응 속도는 서로 맞는 편입니다.', tone: 'warn', badge: '조정이 필요한 흐름' },
        { title: '표현과 의사소통', body: '말을 꺼내는 방식이 서로 다르게 잡힙니다.', tone: 'default', badge: '조건을 함께 봐야 합니다' }
      ]
    };
    const evidence = adaptReunionDeterministicEvidence({ sajuReport: { sections: [delivered] } });

    expect(evidence.find((item) => item.label === '초기 끌림과 반응성')?.tendency).toBe('tension');
    expect(evidence.find((item) => item.label === '표현과 의사소통')?.tendency).toBe('conditional');
    expect(evidence.every((item) => item.tendency !== 'unknown')).toBe(true);
  });

  it('drops a card with no statement and marks an insufficient one unknown', () => {
    const evidence = adaptReunionDeterministicEvidence({ sajuReport: report });
    expect(evidence.some((item) => item.label === '관계 지속과 회복')).toBe(false);
  });

  it('strips the evidence-id block from a detail and keeps its 유보 line as uncertainty', () => {
    const detail = adaptReunionDeterministicEvidence({ sajuReport: report }).find(
      (item) => item.id === 'report:compatibility-evidence-v2:detail:0'
    );
    expect(detail?.statement).toBe('배우자궁에서 접점과 마찰이 함께 잡힙니다.');
    expect(detail?.statement).not.toContain('근거 ID');
    expect(detail?.uncertainty).toContain('상대의 태어난 시간이 확정되지 않았습니다.');
  });

  it('adds nothing when a section carries no cards or details', () => {
    const before = adaptReunionDeterministicEvidence({ sajuReport });
    expect(before.every((item) => !item.id.includes(':card:') && !item.id.includes(':detail:'))).toBe(true);
  });
});
