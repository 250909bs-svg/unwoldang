/**
 * `generateGeminiSajuReport` 전 경로 — 병합 → lock → 컷 병합 → 검사 → 메타 주입.
 *
 * ## 왜 이 파일이 필요한가
 *
 * 이 함수를 호출하는 테스트가 **0건**이었다. 그래서 다음 세 주장이 코드로도 실측으로도
 * 한 번도 검증되지 않았다:
 *   (a) 관측 메타(`aiFields`)를 lock **이후에** 주입한다
 *   (b) 전 필드 거부 시 `deterministic-fallback` 으로 착지한다
 *   (c) 병합 후 검사 실패가 500 이 아니라 fallback 으로 착지한다
 * 누가 (a)의 주입을 lock 앞으로 옮기면 `lockCommercialReportFacts` 가
 * `{...base.engineMeta}` 로 통째 복원하면서 `aiFields` 가 조용히 사라지는데,
 * 어떤 테스트도 실패하지 않았다.
 *
 * 테스트가 불가능한 것도 아니었다 — `getEnv()` 는 호출 시점에 `process.env` 를 읽고
 * 요청은 글로벌 `fetch` 를 쓰므로 `vi.stubGlobal('fetch', …)` + `GEMINI_API_KEY` 로
 * 전 경로를 돌릴 수 있다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildSajuReport, LOVE_REUNION_HERO_NOTE } from '../saju/reportBuilder';
import { finalizeCustomerReport } from '../saju/reportPresentation';
import { generateGeminiSajuReport, type ReportRequestBody } from './geminiReportService';

const reunionForm = {
  name: '재회 검증자',
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  relationshipStatus: 'breakup-reunion' as const,
  partner: {
    name: '상대 검증자',
    gender: 'male' as const,
    calendar: 'solar' as const,
    isLeapMonth: false,
    birthDate: '1991-05-14',
    birthTime: '08:30',
    isUnknownTime: false
  },
  q1: '다시 연락해도 될까요?',
  q2: '답이 없으면 언제 멈춰야 하나요?'
};

const requestBody: ReportRequestBody = {
  serviceId: 'love-reunion',
  payload: {
    user: { name: reunionForm.name, gender: reunionForm.gender },
    birth: {
      calendar: 'solar',
      isLeapMonth: false,
      date: reunionForm.birthDate,
      time: reunionForm.birthTime,
      isUnknownTime: false
    },
    partner: reunionForm.partner,
    relationship: { status: reunionForm.relationshipStatus },
    questions: [reunionForm.q1, reunionForm.q2],
    reunionContext: {
      schemaVersion: 'reunion-context-v1',
      breakupDuration: 'threeTo6m',
      contactStatus: 'occasional',
      lastContactAt: '2026-08-20',
      breakupReason: '대화 방식이 달라 여러 번 부딪혔어요.',
      desiredOutcome: 'clarity',
      notes: '돌려받을 물건이 하나 있어요.',
      consentToUsePartnerData: true
    }
  }
} as ReportRequestBody;

/** 결정론 base 와 근거 ID — 픽스처 응답을 만들 재료. */
function buildBase() {
  const basis = buildDeterministicSajuBasis('love-reunion', reunionForm);
  const report = finalizeCustomerReport(buildSajuReport('love-reunion', reunionForm, basis));
  const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
  expect(ruleId).toBeTruthy();
  return { basis, report, cite: (text: string) => `${text} [근거:${ruleId}]` };
}

function stubGeminiResponse(draft: unknown) {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }],
        usageMetadata: {
          promptTokenCount: 11,
          candidatesTokenCount: 22,
          totalTokenCount: 33
        }
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

let infoSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'fixture-gemini-key';
  process.env.GEMINI_MODEL = 'fixture-gemini-model';
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('generateGeminiSajuReport — 성공 경로', () => {
  it('관측 메타를 lock 이후에 주입한다', async () => {
    const { report, cite } = buildBase();
    stubGeminiResponse({ summary: { title: cite('지금 확인된 것부터 정리해 드릴게요.') } });

    const payload = await generateGeminiSajuReport(requestBody);

    expect(payload.provider).toBe('gemini');
    /*
     * 이 단정이 곧 "주입이 lock 이후" 라는 계약이다. `lockCommercialReportFacts` 가
     * `engineMeta` 를 base 값으로 통째 복원하므로, 주입을 lock 앞으로 옮기면
     * 이 필드가 사라지고 이 줄이 실패한다.
     */
    expect(payload.report.engineMeta?.aiFields).toMatchObject({
      mode: 'authored',
      accepted: 1,
      rejected: 0,
      rejectionsByReason: {}
    });
    expect(payload.report.engineMeta?.aiUsage).toMatchObject({
      provider: 'gemini',
      model: 'fixture-gemini-model',
      totalTokenCount: 33
    });
    // 채택된 문장이 실제로 고객 리포트에 들어갔고, 근거 ID 는 제거됐다.
    expect(payload.report.summary.title).toBe('지금 확인된 것부터 정리해 드릴게요.');
    expect(JSON.stringify(payload.report)).not.toContain('[근거:');
    // 계산값은 그대로다.
    expect(payload.report.pillars).toEqual(report.pillars);
  });

  it('성공 경로에서도 관측 로그를 한 줄 남긴다', async () => {
    const { cite } = buildBase();
    stubGeminiResponse({ summary: { title: cite('지금 확인된 것부터 정리해 드릴게요.') } });

    await generateGeminiSajuReport(requestBody);

    /*
     * 이전에는 `if (review.rejections.length > 0)` 안에서만 로그가 나갔다.
     * 거부 0건이면 한 줄도 안 나가서 authored 모드가 정상 작동 중임을 알리는 신호가
     * 전무했고, 거부율의 **분모**(accepted)가 어떤 로그에도 없었다.
     */
    const entries = infoSpy.mock.calls.map(([line]) => JSON.parse(String(line)));
    const review = entries.find((entry) => entry.event === 'gemini_draft_review');
    expect(review).toBeDefined();
    expect(review).toMatchObject({
      serviceId: 'love-reunion',
      mode: 'authored',
      accepted: 1,
      rejected: 0
    });
    expect(typeof review.reportSerial).toBe('string');
    // 고객 문장은 로그에 싣지 않는다.
    expect(String(infoSpy.mock.calls[0]?.[0])).not.toContain('정리해 드릴게요');
  });

  it('재회운 heroNote 는 lock 이 base 값으로 되돌린다', async () => {
    const { cite } = buildBase();
    stubGeminiResponse({
      heroNote: cite('제가 재회 가능성을 정리해 드릴게요.'),
      summary: { title: cite('지금 확인된 것부터 정리해 드릴게요.') }
    });

    const payload = await generateGeminiSajuReport(requestBody);

    expect(payload.report.heroNote).toBe(LOVE_REUNION_HERO_NOTE);
    expect(payload.report.engineMeta?.aiFields?.rejectionsByReason)
      .toHaveProperty('undeletable-copy-removed');
  });
});

describe('generateGeminiSajuReport — 전 필드 거부', () => {
  it('결정론으로 착지하고 관측 메타와 로그를 남긴다', async () => {
    stubGeminiResponse({ summary: { title: '근거 없이 새로 쓴 문장이에요.' } });

    const payload = await generateGeminiSajuReport(requestBody);

    expect(payload.provider).toBe('deterministic-fallback');
    /*
     * 이전에는 이 조기 반환이 완전히 무음이었고 `aiFields` 도 없었다. 그 결과
     * (a) API 키 없음 (b) 호출 실패 (c) 병합 후 검사 실패 (d) 전 필드 거부 네 가지가
     * ledger 에 똑같은 문자열로 남아 구분이 불가능했다.
     */
    expect(payload.report.engineMeta?.aiFields).toMatchObject({
      mode: 'authored',
      accepted: 0,
      rejected: 1,
      rejectionsByReason: { 'missing-citation': 1 }
    });

    const warned = warnSpy.mock.calls
      .map(([line]) => {
        try {
          return JSON.parse(String(line));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    expect(warned.some((entry) => entry.event === 'gemini_draft_all_rejected')).toBe(true);
  });
});

describe('generateGeminiSajuReport — 병합 후 검사 실패', () => {
  it('500 이 아니라 계열을 되돌려 착지한다', async () => {
    const { report, cite } = buildBase();
    /*
     * `findReportConsistencyViolations`(`reportConsistency.ts:51-55`)는
     * `actionPlan.priorities` 에 같은 문장이 두 번 있으면 위반을 낸다.
     * authored 모드는 그 배열을 모델에게 열어 주므로 **중복 한 줄이 리포트 전체를
     * 버리던** 경로가 있었다. 이제 그 계열만 base 로 되돌리고 나머지는 살린다.
     */
    const duplicated = cite('같은 문장을 두 번 씁니다.');
    stubGeminiResponse({
      summary: { title: cite('지금 확인된 것부터 정리해 드릴게요.') },
      actionPlan: {
        priorities: report.actionPlan.priorities.map(() => duplicated)
      }
    });

    const payload = await generateGeminiSajuReport(requestBody);

    expect(payload.provider).toBe('gemini');
    // 문제가 된 계열만 base 로 돌아갔다.
    expect(payload.report.actionPlan.priorities).toEqual(report.actionPlan.priorities);
    // 다른 계열의 채택은 살아남았다.
    expect(payload.report.summary.title).toBe('지금 확인된 것부터 정리해 드릴게요.');
    expect(payload.report.engineMeta?.aiFields?.revertedFamilies).toContain('actionPlan');
    expect(payload.report.engineMeta?.aiFields?.rejectionsByReason)
      .toHaveProperty('post-merge-revert');
  });
});

describe('generateGeminiSajuReport — 제미나이를 못 부르는 경우', () => {
  it('API 키가 없으면 호출하지 않고 결정론으로 착지한다', async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchMock = stubGeminiResponse({});

    const payload = await generateGeminiSajuReport(requestBody);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload.provider).toBe('deterministic-fallback');
    // 호출 자체가 없었으므로 관측 메타도 없다 — 로그 부재와 구분되는 상태다.
    expect(payload.report.engineMeta?.aiFields).toBeUndefined();
  });

  it('호출이 실패하면 결정론으로 착지한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const payload = await generateGeminiSajuReport(requestBody);

    expect(payload.provider).toBe('deterministic-fallback');
  });
});

describe('generateGeminiSajuReport — 학대 신호가 있는 독자', () => {
  it('산문 권한을 주지 않는다 (상담 착지점이 없는 동안)', async () => {
    const { report, cite } = buildBase();
    stubGeminiResponse({ summary: { title: cite('지금 확인된 것부터 정리해 드릴게요.') } });

    const payload = await generateGeminiSajuReport({
      ...requestBody,
      payload: {
        ...requestBody.payload,
        reunionContext: {
          ...requestBody.payload!.reunionContext!,
          breakupReason: '화가 나면 물건을 던지고 소리를 질렀어요.'
        }
      }
    } as ReportRequestBody);

    /*
     * `REUNION_SUPPORT_CONTACT` 가 `null` 인 동안에는 이 경로에서 authored 를 열지 않는다.
     * 감지는 되는데 안내할 곳이 없는 상태에서 가장 위험한 독자에게 가장 검증이 덜 된
     * 문장을 보내는 것이 이 분기의 위험이다.
     */
    expect(payload.provider).toBe('deterministic-fallback');
    expect(payload.report.engineMeta?.aiFields?.mode).toBe('strict-echo');
    expect(payload.report.summary.title).toBe(report.summary.title);
  });
});
