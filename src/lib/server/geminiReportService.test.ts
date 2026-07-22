import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildSajuReport } from '../saju/reportBuilder';
import {
  assertCommercialReportRequest,
  assertGeminiEvidenceReferences,
  estimateGeminiCostMicros,
  generateGeminiSajuReport,
  sanitizeGeminiDraft,
  stripGeminiEvidenceMetadata,
  toFormData,
  type ReportRequestBody
} from './geminiReportService';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const formData = {
  name: '검증자',
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  q1: '올해 일의 방향은 무엇인가요?',
  q2: ''
};

describe('Gemini commercial response validation', () => {
  it('rejects missing server-side birth facts instead of applying gender/calendar defaults', () => {
    const restored = toFormData({
      serviceId: 'general-signature',
      payload: {
        user: { name: '누락 검사' },
        birth: { date: '1992-09-09', time: '10:24', isUnknownTime: false },
        questions: ['질문 1', '질문 2']
      }
    });

    expect(restored.gender).toBeUndefined();
    expect(restored.calendar).toBeUndefined();
    expect(() => assertCommercialReportRequest('general-signature', restored)).toThrow();
  });

  it('blocks a paid single-chart report when unknown time changes the day pillar', () => {
    expect(() => assertCommercialReportRequest('general-signature', {
      ...formData,
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown',
      dayBoundaryPolicy: 'late-zi',
      q2: '두 번째 질문입니다.'
    })).toThrow(/일주가 달라/);
  });

  it('restores the love micro choice and expanded relationship status', () => {
    const restored = toFormData({
      serviceId: 'love-reading',
      payload: {
        relationship: {
          status: 'breakup-reunion',
          duration: '',
          microChoice: 'B',
          focus: 'next-love-timing'
        }
      }
    });

    expect(restored).toMatchObject({
      relationshipStatus: 'breakup-reunion',
      relationshipDuration: '',
      loveReaction: 'B',
      loveFocus: 'next-love-timing'
    });
  });

  it('restores structured past-life context into intake form data', () => {
    const restored = toFormData({
      serviceId: 'past-life-goblin',
      payload: {
        user: { name: '전생 고객', gender: 'female' },
        birth: {
          calendar: 'solar',
          date: '1994-03-21',
          time: '09:30',
          isUnknownTime: false
        },
        pastLifeContext: {
          topic: '연애',
          repeatedScene: '늘 제가 먼저 관계를 수습해요.',
          frequentEmotion: '억울함',
          hiddenDesire: '책임에서 잠시 벗어나고 싶어요.',
          chosenSymbol: '붉은 실',
          readingTone: '균형 있게'
        },
        questions: ['전생 질문 1', '전생 질문 2']
      }
    });

    expect(restored).toMatchObject({
      pastLifeTopic: '연애',
      repeatedScene: '늘 제가 먼저 관계를 수습해요.',
      frequentEmotion: '억울함',
      hiddenDesire: '책임에서 잠시 벗어나고 싶어요.',
      chosenSymbol: '붉은 실',
      readingTone: '균형 있게',
      q1: '전생 질문 1',
      q2: '전생 질문 2'
    });
  });

  it('accepts exact deterministic prose echoes and strips evidence metadata', () => {
    const basis = buildDeterministicSajuBasis('general-signature', formData);
    const report = buildSajuReport('general-signature', formData, basis);
    const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
    const temporalId = basis.commercialV2.temporal?.findings[0]?.id;
    const baseAnswer = report.questionAnswers[0];
    const baseSection = report.sections.find((section) => section.id === 'saju');
    expect(ruleId).toBeTruthy();
    expect(temporalId).toBeTruthy();
    expect(baseAnswer).toBeTruthy();
    expect(baseSection?.paragraphs?.[0]).toBeTruthy();
    const cite = (text: string, id: string = ruleId!) => `${text} [근거:${id}]`;

    const draft = sanitizeGeminiDraft({
      legalNotice: ['삭제 시도'],
      heroNote: cite(report.heroNote),
      summary: {
        title: cite(report.summary.title),
        analysis: [cite(report.summary.analysis[0])],
        advice: [cite(report.summary.advice[0])]
      },
      questionAnswers: [{
        question: formData.q1,
        title: cite(baseAnswer.title),
        analysis: cite(baseAnswer.analysis),
        advice: baseAnswer.advice.slice(0, 10).map((value) => cite(value))
      }],
      sections: [
        { id: 'expert-evidence-v2', paragraphs: ['변조 시도'] },
        { id: 'saju', paragraphs: [cite(baseSection!.paragraphs![0])] }
      ],
      currentDayun: {
        summary: cite(report.currentDayun.summary, temporalId!)
      },
      actionPlan: {
        title: cite(report.actionPlan.title),
        priorities: [cite(report.actionPlan.priorities[0])]
      }
    }, report);

    expect(draft.questionAnswers?.[0].advice).toHaveLength(Math.min(baseAnswer.advice.length, 10));
    expect(draft.sections).toHaveLength(1);
    expect(draft).not.toHaveProperty('legalNotice');
    expect(() => assertGeminiEvidenceReferences(draft, basis, report)).not.toThrow();

    const stripped = stripGeminiEvidenceMetadata(draft);
    expect(stripped.heroNote).toBe(report.heroNote);
    expect(stripped.currentDayun?.summary).toBe(report.currentDayun.summary);
    expect(JSON.stringify(stripped)).not.toContain('[근거:');
  });

  it('rejects an uncited generated field even when a neighboring field is cited', () => {
    const basis = buildDeterministicSajuBasis('general-signature', formData);
    const report = buildSajuReport('general-signature', formData, basis);
    const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
    const draft = sanitizeGeminiDraft({
      summary: {
        title: `${report.summary.title} [근거:${ruleId}]`,
        analysis: [
          `${report.summary.analysis[0]} [근거:${ruleId}]`,
          report.summary.analysis[1] || report.summary.analysis[0]
        ]
      }
    }, report);

    expect(() => assertGeminiEvidenceReferences(draft, basis, report)).toThrow(/summary\.analysis\.1/);
  });

  it('accepts grounded narrative prose at the evidence-reference layer', () => {
    const basis = buildDeterministicSajuBasis('general-signature', formData);
    const report = buildSajuReport('general-signature', formData, basis);
    const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
    const draft = sanitizeGeminiDraft({
      heroNote: `익숙한 책임을 먼저 목록으로 정리해 보세요. [근거:${ruleId}]`
    }, report);

    expect(() => assertGeminiEvidenceReferences(draft, basis, report)).not.toThrow();
  });

  it('rejects unknown and field-irrelevant evidence IDs', () => {
    const basis = buildDeterministicSajuBasis('general-signature', formData);
    const report = buildSajuReport('general-signature', formData, basis);
    const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;

    const invalid = sanitizeGeminiDraft({
      questionAnswers: [{
        question: formData.q1,
        analysis: `${report.questionAnswers[0].analysis} [근거:not-a-real-rule]`
      }]
    }, report);
    expect(() => assertGeminiEvidenceReferences(invalid, basis, report)).toThrow(/존재하지 않는/);

    const irrelevant = sanitizeGeminiDraft({
      currentDayun: {
        summary: `${report.currentDayun.summary} [근거:${ruleId}]`
      }
    }, report);
    expect(() => assertGeminiEvidenceReferences(irrelevant, basis, report)).toThrow(/문장 범위와 무관한/);
  });

  it('rejects malformed citations and citation-only copy', () => {
    const basis = buildDeterministicSajuBasis('general-signature', formData);
    const report = buildSajuReport('general-signature', formData, basis);
    const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
    const malformed = sanitizeGeminiDraft({ heroNote: `${report.heroNote} [근거:${ruleId}` }, report);
    const citationOnly = sanitizeGeminiDraft({ heroNote: `[근거:${ruleId}]` }, report);

    expect(() => assertGeminiEvidenceReferences(malformed, basis, report)).toThrow(/형식이 잘못/);
    expect(() => assertGeminiEvidenceReferences(citationOnly, basis, report)).toThrow(/인용 외 설명/);
  });

  it('rejects a non-object JSON root', () => {
    const report = buildSajuReport('general-signature', formData);
    expect(() => sanitizeGeminiDraft([], report)).toThrow(/최상위/);
  });
});
const validRequestBody: ReportRequestBody = {
  serviceId: 'general-signature',
  payload: {
    user: { name: 'test-user', gender: 'female' },
    birth: {
      calendar: 'solar',
      isLeapMonth: false,
      date: '1992-09-09',
      time: '10:24',
      isUnknownTime: false,
      precision: 'exact',
      dayBoundaryPolicy: 'late-zi'
    },
    questions: ['question-one', 'question-two']
  }
};

type CapturedPrompt = {
  baseReport: { heroNote: string };
  evidenceIdCatalog: { interpretation: string[] };
  productAdapter: { productId: string; adapterVersion: string };
  immutableFacts: { schemaVersion: string; asOf: string };
  deterministicBasis?: unknown;
};

describe('Gemini provider policy and generation contract', () => {
  it('uses the registered adapter and facts v1, retries once, and records usage metadata', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-2.5-flash');
    vi.stubEnv('GEMINI_RETRY_BASE_DELAY_MS', '0');
    let attempt = 0;
    let capturedPrompt: CapturedPrompt | null = null;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      attempt += 1;
      if (attempt === 1) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: { message: 'not logged' } })
        } as Response;
      }

      const envelope = JSON.parse(String(init?.body)) as {
        contents: Array<{ parts: Array<{ text: string }> }>;
      };
      capturedPrompt = JSON.parse(envelope.contents[0].parts[0].text) as CapturedPrompt;
      const prompt = capturedPrompt as CapturedPrompt;
      const evidenceId = prompt.evidenceIdCatalog.interpretation[0];
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  heroNote: prompt.baseReport.heroNote + ' [근거:' + evidenceId + ']'
                })
              }]
            }
          }],
          usageMetadata: {
            promptTokenCount: 1000,
            candidatesTokenCount: 100,
            totalTokenCount: 1100
          }
        })
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const referenceInstant = '2026-02-03T12:34:56.000Z';
    const result = await generateGeminiSajuReport(validRequestBody, { referenceInstant });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.schemaVersion).toBe('report-response-v1');
    expect(result.provider, JSON.stringify(result.generationMeta)).toBe('gemini');
    expect(result.report.createdAt).toBe(referenceInstant);
    expect(result.generationMeta).toMatchObject({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      attemptCount: 2,
      inputTokens: 1000,
      outputTokens: 100,
      totalTokens: 1100,
      estimatedCostMicros: 550,
      fallback: false,
      cacheStatus: 'miss',
      inputSchemaVersion: 'report-request-v1',
      responseSchemaVersion: 'report-response-v1'
    });
    const prompt = capturedPrompt as CapturedPrompt | null;
    if (!prompt) throw new Error('provider prompt was not captured');
    expect(prompt.productAdapter.productId).toBe('general-signature');
    expect(prompt.immutableFacts).toMatchObject({
      schemaVersion: 'saju-facts-v1',
      asOf: referenceInstant
    });
    expect(prompt).not.toHaveProperty('deterministicBasis');
  });

  it('stops after the bounded retry count and returns a privacy-safe fallback contract', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_RETRY_BASE_DELAY_MS', '0');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'sensitive-provider-detail' } })
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateGeminiSajuReport(validRequestBody, {
      referenceInstant: '2026-02-03T12:34:56.000Z'
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(result.provider).toBe('deterministic-fallback');
    expect(result.generationMeta).toMatchObject({
      provider: 'deterministic-fallback',
      attemptCount: 2,
      fallback: true,
      fallbackReason: 'provider-unavailable',
      errorCode: 'REPORT_PROVIDER_UNAVAILABLE'
    });
  });

  it('degrades without a provider call when the generation lease budget is exhausted', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateGeminiSajuReport(validRequestBody, {
      referenceInstant: '2026-02-03T12:34:56.000Z',
      deadlineInstant: new Date(Date.now() - 1).toISOString()
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.provider).toBe('deterministic-fallback');
    expect(result.generationMeta).toMatchObject({
      attemptCount: 0,
      fallback: true,
      fallbackReason: 'generation-deadline-exceeded',
      errorCode: 'REPORT_TIMEOUT'
    });
  });

  it('estimates cost only for the explicitly priced model', () => {
    expect(estimateGeminiCostMicros('gemini-2.5-flash', 1000, 100)).toBe(550);
    expect(estimateGeminiCostMicros('custom-model', 1000, 100)).toBeNull();
    expect(estimateGeminiCostMicros('gemini-2.5-flash', null, 100)).toBeNull();
  });
});
